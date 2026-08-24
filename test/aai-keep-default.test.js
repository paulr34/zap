/**
 *
 *    Copyright (c) 2025 Silicon Labs
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 *
 *
 * @jest-environment node
 */

const genEngine = require('../src-electron/generator/generation-engine')
const env = require('../src-electron/util/env')
const dbApi = require('../src-electron/db/db-api')
const zclLoader = require('../src-electron/zcl/zcl-loader')
const zclLoaderSilabs = require('../src-electron/zcl/zcl-loader-silabs')
const importJs = require('../src-electron/importexport/import')
const querySession = require('../src-electron/db/query-session')
const queryPackage = require('../src-electron/db/query-package')
const queryEndpointType = require('../src-electron/db/query-endpoint-type')
const queryZcl = require('../src-electron/db/query-zcl')
const matterSdk = require('../src-electron/sdk/matter')
const dbEnum = require('../src-shared/db-enum')
const testUtil = require('./test-util')

let db
let zclPackageId
let templateContext

// The cluster/attribute pair that this test asks to keep its default value.
// FeatureMap is the canonical case: it is still External, so it needs no room
// in the attribute store, but its value is a fixed bitmap that the
// implementation can read out of the generated defaults.
const keepDefaultCluster = 'Software Diagnostics'
const keepDefaultAttribute = 'FeatureMap'

beforeAll(async () => {
  env.setDevelopmentEnv()
  let file = env.sqliteTestFile('aai-keep-default')
  db = await dbApi.initDatabaseAndLoadSchema(
    file,
    env.schemaFile(),
    env.zapVersion()
  )
  let ctx = await zclLoader.loadZcl(db, env.builtinMatterZclMetafile())
  zclPackageId = ctx.packageId
}, testUtil.timeout.medium())

afterAll(() => dbApi.closeDatabase(db), testUtil.timeout.short())

test('Plain entries of attributeAccessInterfaceAttributes keep their meaning', () => {
  let normalized = zclLoaderSilabs.normalizeAttributeAccessInterfaceAttributes({
    'Access Control': ['ClusterRevision', 'AccessControlEntriesPerFabric']
  })
  expect(normalized['Access Control']).toEqual([
    { name: 'ClusterRevision', keepDefault: false },
    { name: 'AccessControlEntriesPerFabric', keepDefault: false }
  ])
})

test('keepDefault is a flag on the same External attribute, not a new storage policy', () => {
  let normalized = zclLoaderSilabs.normalizeAttributeAccessInterfaceAttributes({
    'Access Control': [
      'ClusterRevision',
      { name: 'FeatureMap', keepDefault: true },
      { name: 'AccessControlEntriesPerFabric', keepDefault: false }
    ]
  })
  expect(normalized['Access Control']).toEqual([
    { name: 'ClusterRevision', keepDefault: false },
    { name: 'FeatureMap', keepDefault: true },
    { name: 'AccessControlEntriesPerFabric', keepDefault: false }
  ])
})

test('Malformed entries of attributeAccessInterfaceAttributes are rejected', () => {
  expect(() =>
    zclLoaderSilabs.normalizeAttributeAccessInterfaceAttributes({
      'Access Control': 'FeatureMap'
    })
  ).toThrow(/must be an array/)
  expect(() =>
    zclLoaderSilabs.normalizeAttributeAccessInterfaceAttributes({
      'Access Control': [{ keepDefault: true }]
    })
  ).toThrow(/expected an attribute name/)
  // A typo in the flag would otherwise silently do nothing.
  expect(() =>
    zclLoaderSilabs.normalizeAttributeAccessInterfaceAttributes({
      'Access Control': [{ name: 'FeatureMap', keepDefaults: true }]
    })
  ).toThrow(/Unknown key\(s\) "keepDefaults"/)
})

test(
  'A cluster/attribute pair that keeps its default is still External',
  async () => {
    // This is what the loader records for a metadata file that asks for the
    // default value of this cluster/attribute pair to be kept. The pair is
    // already listed as a plain attribute access interface attribute by the
    // built in Matter metadata, so it is already forced External. The extra
    // option only says not to clear the default.
    await queryPackage.insertOptionsKeyValues(
      db,
      zclPackageId,
      keepDefaultCluster,
      [
        {
          code: dbEnum.keepDefaultOption,
          label: keepDefaultAttribute
        }
      ]
    )

    let forcedExternal = await matterSdk.getForcedExternalStorage(
      db,
      zclPackageId
    )
    expect(
      matterSdk.isForcedExternal(
        forcedExternal,
        keepDefaultCluster,
        keepDefaultAttribute
      )
    ).toBe(true)
    expect(
      matterSdk.keepsDefault(
        forcedExternal,
        keepDefaultCluster,
        keepDefaultAttribute
      )
    ).toBe(true)
    // Everything else in that cluster is unaffected.
    expect(
      matterSdk.isForcedExternal(
        forcedExternal,
        keepDefaultCluster,
        'CurrentHeapFree'
      )
    ).toBe(true)
    expect(
      matterSdk.keepsDefault(
        forcedExternal,
        keepDefaultCluster,
        'CurrentHeapFree'
      )
    ).toBe(false)
    expect(
      matterSdk.keepsDefault(
        forcedExternal,
        keepDefaultCluster,
        'ThisAttributeDoesNotExist'
      )
    ).toBe(false)
  },
  testUtil.timeout.medium()
)

test(
  'An attribute that keeps its default is generated with it, and without attribute store space',
  async () => {
    templateContext = await genEngine.loadTemplates(
      db,
      testUtil.testTemplate.matter3
    )
    expect(templateContext.packageId).not.toBeNull()

    let sessionId = await querySession.createBlankSession(db)
    await importJs.importDataFromFile(db, testUtil.matterTestFile.allClusters, {
      sessionId: sessionId
    })

    // The default value survives the import, which is what makes it editable in
    // the UI and available to generation.
    let endpointTypes = await queryEndpointType.selectAllEndpointTypes(
      db,
      sessionId
    )
    let attributes = []
    for (let et of endpointTypes) {
      attributes.push(
        ...(await queryZcl.selectEndpointTypeAttributesByEndpointId(
          db,
          et.endpointTypeId
        ))
      )
    }
    let featureMaps = []
    for (let a of attributes) {
      if (a.storageOption != dbEnum.storageOption.external) continue
      let definition = await queryZcl.selectAttributeById(db, a.attributeRef)
      let cluster = await queryZcl.selectClusterById(db, a.clusterRef)
      if (
        definition.name == keepDefaultAttribute &&
        cluster.name == keepDefaultCluster
      ) {
        featureMaps.push(a)
      }
    }
    expect(featureMaps.length).toBeGreaterThan(0)
    featureMaps.forEach((a) => expect(a.defaultValue).toEqual('1'))

    let genResult = await genEngine.generate(
      db,
      sessionId,
      templateContext.packageId,
      {},
      { disableDeprecationWarnings: true }
    )
    expect(genResult.hasErrors).toEqual(false)

    let ept = genResult.content['endpoint_config.h']
    // The attribute is still external, so it takes up no space in the attribute
    // store, but the default value is now in the generated data instead of
    // being zeroed out.
    expect(ept).toContain(
      '{ 0x0000FFFC, ZAP_TYPE(BITMAP32), 4, ZAP_ATTRIBUTE_MASK(EXTERNAL_STORAGE), ZAP_SIMPLE_DEFAULT(1) }, /* FeatureMap */'
    )
    // Attributes of the same cluster that were not asked to keep their default
    // still have none.
    expect(ept).toContain(
      '{ 0x00000001, ZAP_TYPE(INT64U), 8, ZAP_ATTRIBUTE_MASK(EXTERNAL_STORAGE), ZAP_EMPTY_DEFAULT() }, /* CurrentHeapFree */'
    )
  },
  testUtil.timeout.long()
)
