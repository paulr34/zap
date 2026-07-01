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
 * @jest-environment jsdom
 */

jest.mock('quasar', () => ({
  Dark: { set: jest.fn() }
}))

import {
  renderer_api_info,
  renderer_api_execute,
  renderer_api_notify
} from '../src/api/renderer_api'
import { timeout } from './test-util'

const rendApi = require('../src-shared/rend-api.js')
const observable = require('../src/util/observable.js')
const { Dark } = require('quasar')

// Provide window globals expected by renderer_api.js
global.window = global.window || {}
window.serverPost = jest.fn(() => Promise.resolve())
window.serverGet = jest.fn(() => Promise.resolve({ data: { DIRTY: true } }))

test(
  'Test structure of renderer API',
  () => {
    let api = renderer_api_info()
    expect(api).not.toBeNull()
    expect(api.prefix).toEqual('zap')
    expect(api.functions.length).toBeGreaterThanOrEqual(2)
  },
  timeout.short()
)

describe('renderer_api_execute', () => {
  beforeEach(() => {
    window.serverPost = jest.fn(() => Promise.resolve())
    window.serverGet = jest.fn(() => Promise.resolve({ data: { DIRTY: true } }))
    Dark.set.mockClear()
  })

  test(
    'progressStart sets observable progress attribute',
    () => {
      renderer_api_execute(rendApi.id.progressStart, 'Loading...')
      expect(
        observable.getObservableAttribute(rendApi.observable.progress_attribute)
      ).toBe('Loading...')
    },
    timeout.short()
  )

  test(
    'progressEnd clears observable progress attribute',
    () => {
      renderer_api_execute(rendApi.id.progressEnd)
      expect(
        observable.getObservableAttribute(rendApi.observable.progress_attribute)
      ).toBe('')
    },
    timeout.short()
  )

  test(
    'reportFiles sets observable with parsed JSON',
    () => {
      const files = [{ path: '/foo/bar.zap' }]
      renderer_api_execute(rendApi.id.reportFiles, JSON.stringify(files))
      expect(
        observable.getObservableAttribute(rendApi.observable.reported_files)
      ).toEqual(files)
    },
    timeout.short()
  )

  test(
    'debugNavBarOn sets debugNavBar observable to true',
    () => {
      renderer_api_execute(rendApi.id.debugNavBarOn)
      expect(
        observable.getObservableAttribute(rendApi.observable.debugNavBar)
      ).toBe(true)
    },
    timeout.short()
  )

  test(
    'debugNavBarOff sets debugNavBar observable to false',
    () => {
      renderer_api_execute(rendApi.id.debugNavBarOff)
      expect(
        observable.getObservableAttribute(rendApi.observable.debugNavBar)
      ).toBe(false)
    },
    timeout.short()
  )

  test(
    'save calls window.serverPost',
    () => {
      renderer_api_execute(rendApi.id.save, '/tmp/test.zap')
      expect(window.serverPost).toHaveBeenCalled()
    },
    timeout.short()
  )

  test(
    'save with no file path calls window.serverPost with empty data',
    () => {
      renderer_api_execute(rendApi.id.save)
      expect(window.serverPost).toHaveBeenCalled()
    },
    timeout.short()
  )

  test(
    'isDirty calls window.serverGet and returns promise',
    async () => {
      const result = renderer_api_execute(rendApi.id.isDirty)
      expect(result).toBeTruthy()
    },
    timeout.short()
  )

  test(
    'setDarkTheme with boolean true calls Dark.set(true)',
    () => {
      renderer_api_execute(rendApi.id.setDarkTheme, true)
      expect(Dark.set).toHaveBeenCalledWith(true)
    },
    timeout.short()
  )

  test(
    'setDarkTheme with string "true" calls Dark.set(true)',
    () => {
      renderer_api_execute(rendApi.id.setDarkTheme, 'true')
      expect(Dark.set).toHaveBeenCalledWith(true)
    },
    timeout.short()
  )

  test(
    'setDarkTheme with string "false" calls Dark.set(false)',
    () => {
      renderer_api_execute(rendApi.id.setDarkTheme, 'false')
      expect(Dark.set).toHaveBeenCalledWith(false)
    },
    timeout.short()
  )

  test(
    'unknown id returns null',
    () => {
      const result = renderer_api_execute('unknownId')
      expect(result).toBeNull()
    },
    timeout.short()
  )
})

describe('renderer_api_notify', () => {
  let postMessageMock

  beforeEach(() => {
    postMessageMock = jest.fn()
    Object.defineProperty(window, 'parent', {
      value: { postMessage: postMessageMock },
      writable: true,
      configurable: true
    })
  })

  test(
    'posts message to parent window',
    () => {
      renderer_api_notify('someKey', 'someValue')
      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: 'someKey', eventData: 'someValue' }),
        '*'
      )
    },
    timeout.short()
  )

  test(
    'transforms dirtyFlag key and value for IDE protocol',
    () => {
      const dbEnum = require('../src-shared/db-enum.js')
      renderer_api_notify(dbEnum.wsCategory.dirtyFlag, true)
      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'dirty',
          eventData: { isDirty: true }
        }),
        '*'
      )
    },
    timeout.short()
  )
})
