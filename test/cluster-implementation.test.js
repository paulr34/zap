/**
 *
 *    Copyright (c) 2026 Silicon Labs
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

const path = require('path')
const dbApi = require('../src-electron/db/db-api')
const dbEnum = require('../src-shared/db-enum')
const env = require('../src-electron/util/env')
const helperZcl = require('../src-electron/generator/helper-zcl')
const matter = require('../src-electron/sdk/matter')
const queryCluster = require('../src-electron/db/query-cluster')
const queryZcl = require('../src-electron/db/query-zcl')
const testUtil = require('./test-util')
const zclLoader = require('../src-electron/zcl/zcl-loader')

let db
let packageId

beforeAll(async () => {
  env.setDevelopmentEnv()
  let file = env.sqliteTestFile('cluster-implementation')
  db = await dbApi.initDatabaseAndLoadSchema(
    file,
    env.schemaFile(),
    env.zapVersion()
  )
  let context = await zclLoader.loadZcl(db, testUtil.codeDrivenZclMetafile)
  packageId = context.packageId
}, testUtil.timeout.medium())

afterAll(() => dbApi.closeDatabase(db), testUtil.timeout.short())

test(
  'Cluster implementation is recorded on the cluster',
  async () => {
    let implementations = await queryCluster.selectClusterImplementations(
      db,
      packageId
    )
    // Only the clusters that the metadata names are recorded.
    expect(implementations.length).toEqual(2)

    let test1 = implementations.find((c) => c.name == 'Test 1')
    expect(test1.implementation).toEqual(
      dbEnum.clusterImplementation.codeDriven
    )
    let test2 = implementations.find((c) => c.name == 'Test 2')
    expect(test2.implementation).toEqual(dbEnum.clusterImplementation.ember)

    // The implementation travels with the cluster, so the UI and templates can
    // see it without a second query.
    let clusters = await queryZcl.selectAllClusters(db, packageId)
    expect(clusters.find((c) => c.name == 'Test 1').implementation).toEqual(
      dbEnum.clusterImplementation.codeDriven
    )
  },
  testUtil.timeout.medium()
)

test(
  'Attribute handling becomes a storage policy',
  async () => {
    let clusters = await queryZcl.selectAllClusters(db, packageId)
    let test1 = clusters.find((c) => c.name == 'Test 1')
    let attributes = await queryZcl.selectAttributesByClusterIdIncludingGlobal(
      db,
      test1.id,
      packageId
    )

    // 'internal' means the implementation provides everything.
    expect(attributes.find((a) => a.name == 'at1').storagePolicy).toEqual(
      dbEnum.storagePolicy.attributeAccessInterface
    )
    // 'default-only' means ZAP still provides the default value.
    expect(attributes.find((a) => a.name == 'at2').storagePolicy).toEqual(
      dbEnum.storagePolicy.defaultOnly
    )

    // A cluster the metadata calls ember keeps the choice with the user.
    let test2 = clusters.find((c) => c.name == 'Test 2')
    let test2Attributes =
      await queryZcl.selectAttributesByClusterIdIncludingGlobal(
        db,
        test2.id,
        packageId
      )
    test2Attributes.forEach((attribute) => {
      expect(attribute.storagePolicy).toEqual(dbEnum.storagePolicy.any)
    })
  },
  testUtil.timeout.medium()
)

test(
  'Both policies take the storage choice away, and keep the defaults apart',
  async () => {
    let forced = await matter.getForcedExternalStorage(db, packageId)
    let at1 = forced.find(
      (o) => o.optionCategory == 'Test 1' && o.optionLabel == 'at1'
    )
    let at2 = forced.find(
      (o) => o.optionCategory == 'Test 1' && o.optionLabel == 'at2'
    )
    expect(at1.optionCode).toEqual(
      dbEnum.storagePolicy.attributeAccessInterface
    )
    expect(at2.optionCode).toEqual(dbEnum.storagePolicy.defaultOnly)

    // Neither attribute lives in the attribute store.
    expect(
      await matter.computeStorageOptionNewConfig(
        dbEnum.storagePolicy.attributeAccessInterface
      )
    ).toEqual(dbEnum.storageOption.external)
    expect(
      await matter.computeStorageOptionNewConfig(
        dbEnum.storagePolicy.defaultOnly
      )
    ).toEqual(dbEnum.storageOption.external)

    // The policy of an attribute is the one the metadata asked for, so an
    // attribute that only needs its default does not get treated like one that
    // needs nothing.
    let clusters = await queryZcl.selectAllClusters(db, packageId)
    let test1 = clusters.find((c) => c.name == 'Test 1')
    expect(
      await matter.computeStoragePolicyNewConfig(
        db,
        test1.id,
        dbEnum.storagePolicy.any,
        forced,
        'at2'
      )
    ).toEqual(dbEnum.storagePolicy.defaultOnly)
    expect(
      await matter.computeStorageImport(
        db,
        'Test 1',
        dbEnum.storagePolicy.any,
        forced,
        'at1'
      )
    ).toEqual(dbEnum.storagePolicy.attributeAccessInterface)
  },
  testUtil.timeout.medium()
)

test(
  'Templates can tell a code driven cluster from an ember one',
  async () => {
    let clusters = await queryZcl.selectAllClusters(db, packageId)
    let test1 = clusters.find((c) => c.name == 'Test 1')
    let test2 = clusters.find((c) => c.name == 'Test 2')

    // The helper reads the implementation off the context when there is one,
    // and falls back to a query when the context is not a cluster.
    let context = { global: { db: db } }
    let options = {
      fn: () => 'code driven',
      inverse: () => 'ember'
    }
    expect(
      await helperZcl.if_cluster_code_driven.call(context, test1.id, options)
    ).toEqual('code driven')
    expect(
      await helperZcl.if_cluster_code_driven.call(context, test2.id, options)
    ).toEqual('ember')
    expect(
      await helperZcl.if_cluster_code_driven.call(
        Object.assign({}, test1, context),
        options
      )
    ).toEqual('code driven')

    // An explicit cluster id wins over whatever the context happens to hold.
    expect(
      await helperZcl.if_cluster_code_driven.call(
        Object.assign({}, test1, context),
        test2.id,
        options
      )
    ).toEqual('ember')

    // Without either, the helper says so instead of guessing a cluster from a
    // context that carries an id of its own.
    await expect(
      helperZcl.if_cluster_code_driven.call(
        Object.assign({ id: 12345, clusterId: '0x00000006' }, context),
        options
      )
    ).rejects.toThrow('needs a cluster in the context')
  },
  testUtil.timeout.medium()
)

test(
  'Attribute handling of a cluster falls back to the cluster entry',
  () => {
    const clusterImplementation = require('../src-electron/zcl/cluster-implementation')
    let codeDriven = {
      implementation: dbEnum.clusterImplementation.codeDriven,
      attributes: { '*': 'default-only', State: 'internal' }
    }
    expect(
      clusterImplementation.attributeHandlingOf(codeDriven, 'State')
    ).toEqual(dbEnum.attributeHandling.internal)
    expect(
      clusterImplementation.attributeHandlingOf(codeDriven, 'Anything')
    ).toEqual(dbEnum.attributeHandling.defaultOnly)

    // A code driven cluster that says nothing about an attribute owns it.
    expect(
      clusterImplementation.attributeHandlingOf(
        { implementation: dbEnum.clusterImplementation.codeDriven },
        'Anything'
      )
    ).toEqual(dbEnum.attributeHandling.internal)

    // An ember cluster leaves the choice with the user.
    expect(clusterImplementation.attributeHandlingOf({}, 'Anything')).toEqual(
      dbEnum.attributeHandling.any
    )

    expect(() =>
      clusterImplementation.attributeHandlingOf(
        { attributes: { State: 'nonsense' } },
        'State'
      )
    ).toThrow('Unknown attribute handling "nonsense"')
  },
  testUtil.timeout.short()
)

test(
  'Cluster implementation metadata is validated against the loaded ZCL',
  async () => {
    const clusterImplementation = require('../src-electron/zcl/cluster-implementation')

    await expect(
      clusterImplementation.loadClusterImplementation(db, packageId, {
        clusters: { 'No Such Cluster': { implementation: 'code-driven' } }
      })
    ).rejects.toThrow('Unknown cluster "No Such Cluster"')

    await expect(
      clusterImplementation.loadClusterImplementation(db, packageId, {
        clusters: {
          'Test 1': {
            implementation: 'code-driven',
            attributes: { noSuchAttribute: 'internal' }
          }
        }
      })
    ).rejects.toThrow('Unknown attribute "noSuchAttribute"')

    await expect(
      clusterImplementation.loadClusterImplementation(db, packageId, {})
    ).rejects.toThrow('Missing "clusters" key')
  },
  testUtil.timeout.medium()
)

test(
  'Cluster implementation metadata can be given inline or in a file',
  async () => {
    const clusterImplementation = require('../src-electron/zcl/cluster-implementation')
    let metadataFile = testUtil.codeDrivenZclMetafile

    let fromFile = await clusterImplementation.resolveClusterImplementation(
      metadataFile,
      'cluster-implementation.json'
    )
    expect(Object.keys(fromFile.clusters)).toContain('Test 1')

    let inline = { clusters: { 'Test 1': { implementation: 'ember' } } }
    expect(
      await clusterImplementation.resolveClusterImplementation(
        metadataFile,
        inline
      )
    ).toEqual(inline)

    expect(
      await clusterImplementation.resolveClusterImplementation(
        metadataFile,
        null
      )
    ).toBeNull()

    await expect(
      clusterImplementation.resolveClusterImplementation(
        metadataFile,
        path.join('..', 'meta', 'test1.xml')
      )
    ).rejects.toThrow('Invalid JSON in cluster implementation file')
  },
  testUtil.timeout.medium()
)
