/**
 *
 *    Copyright (c) 2022 Silicon Labs
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
const genEngine = require('../src-electron/generator/generation-engine')
const env = require('../src-electron/util/env')
const dbApi = require('../src-electron/db/db-api')
const queryAttribute = require('../src-electron/db/query-attribute')
const querySession = require('../src-electron/db/query-session')
const queryPackage = require('../src-electron/db/query-package')
const queryZcl = require('../src-electron/db/query-zcl')
const sessionNotification = require('../src-electron/db/query-session-notification')
const zclLoader = require('../src-electron/zcl/zcl-loader')
const importJs = require('../src-electron/importexport/import')
const util = require('../src-electron/util/util')
const testUtil = require('./test-util')
const testQuery = require('./test-query')
const dbEnum = require('../src-shared/db-enum')

/**
 * Returns the category of the session package of a given type.
 *
 * @param {*} sessionId
 * @param {*} packageType
 * @returns array of categories.
 */
async function sessionPackageCategories(sessionId, packageType) {
  let pkgs = await queryPackage.getSessionPackagesWithTypes(db, sessionId)
  let categories = []
  for (let pkg of pkgs.filter((p) => p.type === packageType)) {
    let p = await queryPackage.getPackageByPackageId(db, pkg.packageRef)
    categories.push(p.category)
  }
  return categories
}

let db

// These two files have intentionally wrong paths in the package, so
// that it tests the ability of the zap files that got moved around
// to attach to proper packages via category.
const testFileMatter = path.join(__dirname, 'resource/mp-matter.zap')
const testFileZigbee = path.join(__dirname, 'resource/mp-zigbee.zap')

beforeAll(async () => {
  env.setDevelopmentEnv()
  let file = env.sqliteTestFile('multi-package')
  db = await dbApi.initDatabaseAndLoadSchema(
    file,
    env.schemaFile(),
    env.zapVersion()
  )
  await zclLoader.loadZcl(db, env.builtinMatterZclMetafile())
  await zclLoader.loadZcl(db, env.builtinSilabsZclMetafile())
  await genEngine.loadTemplates(db, testUtil.testTemplate.matter)
  await genEngine.loadTemplates(db, testUtil.testTemplate.zigbee)
}, testUtil.timeout.medium())

afterAll(() => dbApi.closeDatabase(db), testUtil.timeout.short())

test('Validate loaded packages', async () => {
  expect(
    await testQuery.selectCountFrom(
      db,
      "PACKAGE WHERE PACKAGE.TYPE = 'zcl-properties'"
    )
  ).toBe(2)
  expect(
    await testQuery.selectCountFrom(
      db,
      "PACKAGE WHERE PACKAGE.TYPE = 'gen-templates-json'"
    )
  ).toBe(2)
})

test('Validate Matter zap file.', async () => {
  let sessionId = await querySession.createBlankSession(db)
  await importJs.importDataFromFile(db, testFileMatter, {
    sessionId: sessionId
  })
  let pkgs = await queryPackage.getSessionPackagesWithTypes(db, sessionId)
  expect(pkgs.length).toBe(2)
  for (let pkg of pkgs) {
    if (pkg.type === dbEnum.packageType.zclProperties) {
      let p = await queryPackage.getPackageByPackageId(db, pkg.packageRef)
      expect(p.category).toBe('matter')
    } else if (pkg.type === dbEnum.packageType.genTemplatesJson) {
      let p = await queryPackage.getPackageByPackageId(db, pkg.packageRef)
      expect(p.category).toBe('matter')
    } else {
      fail('Unknown package type.')
    }
  }
})

test('Session uses the requested zcl and template metafiles', async () => {
  let sessionId = await querySession.createBlankSession(db)
  await util.ensurePackagesAndPopulateSessionOptions(db, sessionId, {
    zcl: env.builtinSilabsZclMetafile(),
    template: testUtil.testTemplate.zigbee
  })
  expect(
    await sessionPackageCategories(sessionId, dbEnum.packageType.zclProperties)
  ).toEqual(['zigbee'])
  expect(
    await sessionPackageCategories(
      sessionId,
      dbEnum.packageType.genTemplatesJson
    )
  ).toEqual(['zigbee'])
})

test('Session uses the requested metafiles when they are passed as command line arrays', async () => {
  // Command line arguments arrive as arrays and the paths in them can be
  // relative, neither of which must prevent the match.
  let sessionId = await querySession.createBlankSession(db)
  await util.ensurePackagesAndPopulateSessionOptions(db, sessionId, {
    zcl: [path.relative(process.cwd(), env.builtinMatterZclMetafile())],
    template: [testUtil.testTemplate.matter]
  })
  expect(
    await sessionPackageCategories(sessionId, dbEnum.packageType.zclProperties)
  ).toEqual(['matter'])
  expect(
    await sessionPackageCategories(
      sessionId,
      dbEnum.packageType.genTemplatesJson
    )
  ).toEqual(['matter'])
})

test('Session falls back to a loaded zcl metafile and reports it', async () => {
  // This metafile exists, but it was never loaded into this database, which is
  // what happens when a project is opened against an SDK that zap does not
  // know about.
  let unknownMetafile = env.builtinNewMatterZclMetafile()
  let sessionId = await querySession.createBlankSession(db)
  await util.ensurePackagesAndPopulateSessionOptions(db, sessionId, {
    zcl: unknownMetafile,
    template: testUtil.testTemplate.matter
  })
  // The session still has to end up with a data model, otherwise it shows no
  // clusters at all.
  expect(
    await sessionPackageCategories(sessionId, dbEnum.packageType.zclProperties)
  ).toHaveLength(1)
  let notifications = await sessionNotification.getNotification(db, sessionId)
  // The warning has to name the metafile that could not be matched, so that
  // the mismatch can be tracked down from the notifications page.
  let messages = notifications.map((n) => n.message)
  expect(messages.some((m) => m.includes(unknownMetafile))).toBeTruthy()
  expect(messages.some((m) => m.includes('undefined'))).toBeFalsy()
})

test('Validate Zigbee zap file.', async () => {
  let sessionId = await querySession.createBlankSession(db)
  await importJs.importDataFromFile(db, testFileZigbee, {
    sessionId: sessionId
  })
  let pkgs = await queryPackage.getSessionPackagesWithTypes(db, sessionId)
  expect(pkgs.length).toBe(2)
  for (let pkg of pkgs) {
    if (pkg.type === dbEnum.packageType.zclProperties) {
      let p = await queryPackage.getPackageByPackageId(db, pkg.packageRef)
      expect(p.category).toBe('zigbee')
    } else if (pkg.type === dbEnum.packageType.genTemplatesJson) {
      let p = await queryPackage.getPackageByPackageId(db, pkg.packageRef)
      expect(p.category).toBe('zigbee')
    } else {
      fail('Unknown package type.')
    }
  }
})
