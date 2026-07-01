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

const dbApi = require('../src-electron/db/db-api')
const env = require('../src-electron/util/env')
const zclLoader = require('../src-electron/zcl/zcl-loader')
const restApi = require('../src-shared/rest-api')
const util = require('../src-electron/util/util')
const initialize = require('../src-electron/rest/initialize')
const testUtil = require('./test-util')
const testQuery = require('./test-query')

let db
let sessionUuid = util.createUuid()
let sessionId

beforeAll(async () => {
  env.setDevelopmentEnv()
  let file = env.sqliteTestFile('rest-initialize')
  db = await dbApi.initDatabaseAndLoadSchema(
    file,
    env.schemaFile(),
    env.zapVersion()
  )
  await zclLoader.loadZcl(db, env.builtinSilabsZclMetafile())
  sessionId = await testQuery.createSession(
    db,
    'USER',
    sessionUuid,
    env.builtinSilabsZclMetafile(),
    env.builtinTemplateMetafile()
  )
}, testUtil.timeout.long())

afterAll(() => dbApi.closeDatabase(db), testUtil.timeout.medium())

/**
 * Builds a minimal Express-like response mock capturing status and body.
 */
function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    send(body) {
      this.body = body
      return this
    }
  }
}

test(
  'init handler returns initialized message',
  async () => {
    const res = mockRes()
    await initialize.init(db)({}, res)
    expect(res.body.message).toBe('Session initialized')
  },
  testUtil.timeout.medium()
)

test(
  'sessionAttempt with no filePath returns packages and sessions',
  async () => {
    const res = mockRes()
    await initialize.sessionAttempt(db)({ body: { search: '' } }, res)
    expect(res.body.open).toBe(false)
    expect(Array.isArray(res.body.zclProperties)).toBe(true)
    expect(Array.isArray(res.body.sessions)).toBe(true)
  },
  testUtil.timeout.medium()
)

test(
  'sessionAttempt with a non-zap filePath returns packages',
  async () => {
    const res = mockRes()
    await initialize.sessionAttempt(db)(
      { body: { search: 'filePath=/tmp/not-a-zap-file.txt' } },
      res
    )
    expect(res.body.open).toBe(true)
    expect(Array.isArray(res.body.zclGenTemplates)).toBe(true)
  },
  testUtil.timeout.medium()
)

test(
  'sessionAttempt with a real .zap filePath parses categories',
  async () => {
    const res = mockRes()
    const search = `filePath=${encodeURIComponent(
      testUtil.zigbeeTestFile.threeEp
    )}`
    await initialize.sessionAttempt(db)({ body: { search } }, res)
    expect(res.body.open).toBe(true)
    expect(res.body.filePath).toContain('three-endpoint-device.zap')
    expect(Array.isArray(res.body.zapFilePackages)).toBe(true)
  },
  testUtil.timeout.long()
)

test(
  'initializeSession populates session options',
  async () => {
    const res = mockRes()
    await initialize.initializeSession(db)(
      { body: { sessionId, zclProperties: [], genTemplate: [] } },
      res
    )
    expect(res.body.message).toBe('Session created successfully')
  },
  testUtil.timeout.long()
)

test(
  'sessionCreate ensures user and session',
  async () => {
    const res = mockRes()
    const newUuid = util.createUuid()
    const req = {
      body: { zclProperties: [], genTemplate: [] },
      query: { [restApi.param.sessionId]: newUuid },
      session: { id: 'USER-CREATE' }
    }
    await initialize.sessionCreate(db)(req, res)
    expect(res.body.message).toBe('Session created successfully')
    expect(req.session.zapUserId).not.toBeNull()
  },
  testUtil.timeout.long()
)

test(
  'sessionCreate returns early when sessionUuid or userKey is missing',
  async () => {
    const res = mockRes()
    const req = {
      body: {},
      query: {},
      session: {}
    }
    await initialize.sessionCreate(db)(req, res)
    // No sessionId in query and no session.id => early return, body stays null
    expect(res.body).toBeNull()
  },
  testUtil.timeout.medium()
)

test(
  'loadPreviousSessions reloads a session',
  async () => {
    const res = mockRes()
    const req = {
      query: { [restApi.param.sessionId]: sessionUuid },
      session: { id: 'USER' },
      body: { sessionId }
    }
    await initialize.loadPreviousSessions(db)(req, res)
    expect(res.body.message).toBe('Session reloaded successfully')
  },
  testUtil.timeout.long()
)
