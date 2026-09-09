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
 * @jest-environment jsdom
 */

import {
  getRecentZapFiles,
  getRecentZapFilesLookbackDays,
  isZapFilePath,
  mergeRecentZapFilesFromServer,
  normalizeZapPath,
  recordRecentZapFile,
  removeRecentZapFile,
  setRecentZapFilesLookbackDays,
  zapPathKey
} from '../src/util/recent-zap-files.js'
import rendApi from '../src-shared/rend-api.js'
import { timeout } from './test-util'

beforeEach(() => {
  window.localStorage.clear()
})

test(
  'recent zap files default lookback is 21 days',
  () => {
    expect(getRecentZapFilesLookbackDays()).toBe(
      rendApi.DEFAULT_RECENT_ZAP_FILES_LOOKBACK_DAYS
    )
    setRecentZapFilesLookbackDays(14)
    expect(getRecentZapFilesLookbackDays()).toBe(14)
  },
  timeout.short()
)

test(
  'only real .zap extensions are accepted',
  () => {
    expect(isZapFilePath('/tmp/a.zap')).toBe(true)
    expect(isZapFilePath('/tmp/a.ZAP')).toBe(true)
    expect(isZapFilePath('/tmp/a.zap.bak')).toBe(false)
    expect(isZapFilePath('/tmp/readme.txt')).toBe(false)
    recordRecentZapFile('/tmp/readme.txt')
    recordRecentZapFile('/tmp/a.zap.bak')
    expect(getRecentZapFiles().length).toBe(0)
  },
  timeout.short()
)

test(
  'normalizes and dedupes path variants',
  () => {
    expect(normalizeZapPath('C:\\foo\\bar.zap')).toBe('C:/foo/bar.zap')
    expect(zapPathKey('C:\\Foo\\Bar.zap')).toBe(zapPathKey('c:/foo/bar.zap'))
    recordRecentZapFile('C:\\Foo\\Bar.zap')
    recordRecentZapFile('c:/foo/bar.zap')
    expect(getRecentZapFiles().length).toBe(1)
  },
  timeout.short()
)

test(
  'record and filter recent zap files by lookback',
  () => {
    recordRecentZapFile('/tmp/a.zap')
    recordRecentZapFile('/tmp/b.zap')
    let files = getRecentZapFiles()
    expect(files.length).toBe(2)
    expect(files[0].path).toBe('/tmp/b.zap')
    expect(files[0].name).toBe('b.zap')

    setRecentZapFilesLookbackDays(1)
    let stored = JSON.parse(
      window.localStorage.getItem(rendApi.storageKey.recentZapFiles)
    )
    stored[1].lastOpened = Date.now() - 3 * 24 * 60 * 60 * 1000
    window.localStorage.setItem(
      rendApi.storageKey.recentZapFiles,
      JSON.stringify(stored)
    )
    files = getRecentZapFiles()
    expect(files.length).toBe(1)
    expect(files[0].path).toBe('/tmp/b.zap')

    removeRecentZapFile('/tmp/b.zap')
    expect(getRecentZapFiles().length).toBe(0)
  },
  timeout.short()
)

test(
  'merges server/DB entries for cold start',
  () => {
    window.localStorage.setItem(
      rendApi.storageKey.fileSave,
      '/tmp/last-pref.zap'
    )
    mergeRecentZapFilesFromServer([
      { path: '/tmp/from-db.zap', lastOpened: Date.now() - 1000 }
    ])
    let files = getRecentZapFiles()
    let paths = files.map((f) => f.path)
    expect(paths).toContain('/tmp/from-db.zap')
    expect(paths).toContain('/tmp/last-pref.zap')
  },
  timeout.short()
)
