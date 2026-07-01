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
 * @jest-environment jsdom
 */

// Quasar must be mocked before ws.js is loaded (Notify is used in listeners)
jest.mock('quasar', () => ({
  Notify: { create: jest.fn() }
}))

import { timeout } from './test-util.js'

const { Notify } = require('quasar')
const rendApi = require('../src-shared/rend-api.js')
const dbEnum = require('../src-shared/db-enum.js')

describe('src/boot/ws.js', () => {
  let mockWsInstance
  let wsBoot
  let app

  beforeAll(() => {
    // Set up the WebSocket mock BEFORE ws.js is loaded
    mockWsInstance = {
      send: jest.fn(),
      onopen: null,
      onmessage: null,
      close: jest.fn()
    }
    global.WebSocket = jest.fn(() => mockWsInstance)

    // Also provide window.location with sessionStorage (jsdom provides these)
    // but ensure rendApi symbol is available for ws.js listeners
    global.window[rendApi.GLOBAL_SYMBOL_NOTIFY] = jest.fn()

    jest.isolateModules(() => {
      wsBoot = require('../src/boot/ws').default
    })

    // Wire up boot function so $sendWebSocketData etc. are available
    app = { config: { globalProperties: {} } }
    wsBoot({ app })
  })

  beforeEach(() => {
    mockWsInstance.send.mockClear()
    Notify.create.mockClear()
  })

  test(
    'WebSocket is created on module load',
    () => {
      expect(global.WebSocket).toHaveBeenCalled()
    },
    timeout.short()
  )

  test(
    '$sendWebSocketData sends JSON-serialized category+payload',
    () => {
      app.config.globalProperties.$sendWebSocketData(
        'testCategory',
        'testPayload'
      )
      expect(mockWsInstance.send).toHaveBeenCalledWith(
        JSON.stringify({ category: 'testCategory', payload: 'testPayload' })
      )
    },
    timeout.short()
  )

  test(
    '$sendWebSocketData omits payload when null',
    () => {
      app.config.globalProperties.$sendWebSocketData('init')
      expect(mockWsInstance.send).toHaveBeenCalledWith(
        JSON.stringify({ category: 'init' })
      )
    },
    timeout.short()
  )

  test(
    '$sendWebSocketMessage sends JSON-serialized message',
    () => {
      const msg = { custom: 'data' }
      app.config.globalProperties.$sendWebSocketMessage(msg)
      expect(mockWsInstance.send).toHaveBeenCalledWith(JSON.stringify(msg))
    },
    timeout.short()
  )

  test(
    '$onWebSocket registers listener that fires on incoming category',
    () => {
      const listener = jest.fn()
      app.config.globalProperties.$onWebSocket('myCategory', listener)

      // Simulate incoming WebSocket message with matching category
      mockWsInstance.onmessage({
        data: JSON.stringify({ category: 'myCategory', payload: 'hello' })
      })

      expect(listener).toHaveBeenCalledWith('hello')
    },
    timeout.short()
  )

  test(
    'incoming message without category/payload emits as generic',
    () => {
      const genericListener = jest.fn()
      app.config.globalProperties.$onWebSocket(
        dbEnum.wsCategory.generic,
        genericListener
      )

      // Message without proper structure → emits to generic
      mockWsInstance.onmessage({
        data: JSON.stringify({ raw: 'unstructured' })
      })

      expect(genericListener).toHaveBeenCalledWith({ raw: 'unstructured' })
    },
    timeout.short()
  )

  test(
    'dirtyFlag ws message invokes global notify function',
    () => {
      const notifyFn = jest.fn()
      global.window[rendApi.GLOBAL_SYMBOL_NOTIFY] = notifyFn

      mockWsInstance.onmessage({
        data: JSON.stringify({
          category: dbEnum.wsCategory.dirtyFlag,
          payload: true
        })
      })

      expect(notifyFn).toHaveBeenCalledWith(rendApi.notifyKey.dirtyFlag, true)
    },
    timeout.short()
  )

  test(
    'sessionCreationError ws message calls Notify.create',
    () => {
      mockWsInstance.onmessage({
        data: JSON.stringify({
          category: dbEnum.wsCategory.sessionCreationError,
          payload: 'Session limit reached'
        })
      })

      expect(Notify.create).toHaveBeenCalledWith(
        expect.objectContaining({ color: 'negative' })
      )
    },
    timeout.short()
  )

  test(
    'notificationInfo with display != 0 calls Notify.create',
    () => {
      mockWsInstance.onmessage({
        data: JSON.stringify({
          category: dbEnum.wsCategory.notificationInfo,
          payload: { display: 1, message: 'Important notification' }
        })
      })

      expect(Notify.create).toHaveBeenCalledWith(
        expect.objectContaining({ color: 'negative' })
      )
    },
    timeout.short()
  )

  test(
    'notificationInfo with display == 0 does not call Notify.create',
    () => {
      Notify.create.mockClear()
      mockWsInstance.onmessage({
        data: JSON.stringify({
          category: dbEnum.wsCategory.notificationInfo,
          payload: { display: 0, message: 'Silent notification' }
        })
      })

      expect(Notify.create).not.toHaveBeenCalled()
    },
    timeout.short()
  )

  test(
    'onopen handler sends WebSocket init message',
    () => {
      // Calling onopen triggers sendWebSocketInit → sendWebSocketData
      mockWsInstance.send.mockClear()
      mockWsInstance.onopen()
      expect(mockWsInstance.send).toHaveBeenCalled()
      const sentMsg = JSON.parse(mockWsInstance.send.mock.calls[0][0])
      expect(sentMsg.category).toBe(dbEnum.wsCategory.init)
    },
    timeout.short()
  )
})
