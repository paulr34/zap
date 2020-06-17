/**
 *
 *    Copyright (c) 2020 Silicon Labs
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

var sq = require('sqlite3')

import { version } from '../package.json'
const dbApi = require('../src-electron/db/db-api.js')
import { selectCountFrom } from '../src-electron/db/query-generic'
import {
  selectAllBitmaps,
  selectAllClusters,
  selectAllDeviceTypes,
  selectAllDomains,
  selectAllEnums,
  selectAllStructs,
} from '../src-electron/db/query-zcl'
import { zclPropertiesFile } from '../src-electron/main-process/args'
import { schemaFile } from '../src-electron/util/env'
import { loadZcl } from '../src-electron/zcl/zcl-loader'

test('test opening and closing the database', () => {
  var db = new sq.Database(':memory:')
  return dbApi.closeDatabase(db)
})

test('test database schema loading in memory', () => {
  var db = new sq.Database(':memory:')
  return dbApi
    .loadSchema(db, schemaFile(), version)
    .then((db) => dbApi.closeDatabase(db))
})

test('test zcl data loading in memory', () => {
  var db = new sq.Database(':memory:')
  return dbApi
    .loadSchema(db, schemaFile(), version)
    .then((db) => loadZcl(db, zclPropertiesFile)) // Maybe: ../../../zcl/zcl-studio.properties
    .then(() => selectAllClusters(db))
    .then((x) => expect(x.length).toEqual(106))
    .then(() => selectAllDomains(db))
    .then((x) => expect(x.length).toEqual(20))
    .then(() => selectAllEnums(db))
    .then((x) => expect(x.length).toEqual(206))
    .then(() => selectAllStructs(db))
    .then((x) => expect(x.length).toEqual(50))
    .then(() => selectAllBitmaps(db))
    .then((x) => expect(x.length).toEqual(121))
    .then(() => selectAllDeviceTypes(db))
    .then((x) => expect(x.length).toEqual(152))
    .then(() => selectCountFrom(db, 'COMMAND_ARG'))
    .then((x) => expect(x).toEqual(1668))
    .then(() => selectCountFrom(db, 'COMMAND'))
    .then((x) => expect(x).toEqual(560))
    .then(() => selectCountFrom(db, 'ENUM_ITEM'))
    .then((x) => expect(x).toEqual(1552))
    .then(() => selectCountFrom(db, 'ATTRIBUTE'))
    .then((x) => expect(x).toEqual(3416))
    .then(() => selectCountFrom(db, 'BITMAP_FIELD'))
    .then((x) => expect(x).toEqual(724))
    .then(() => selectCountFrom(db, 'STRUCT_ITEM'))
    .then((x) => expect(x).toEqual(154))
    .then(() =>
      dbApi.dbMultiSelect(db, 'SELECT CLUSTER_ID FROM CLUSTER WHERE CODE = ?', [
        ['0x0000'],
        ['0x0006'],
      ])
    )
    .then((rows) => {
      expect(rows.length).toBe(2)
      expect(rows[0]).not.toBeUndefined()
      expect(rows[1]).not.toBeUndefined()
      expect(rows[0].CLUSTER_ID).not.toBeUndefined()
      expect(rows[1].CLUSTER_ID).not.toBeUndefined()
    })
    .finally(() => {
      dbApi.closeDatabase(db)
    })
}, 5000) // Give this test 5 secs to resolve
