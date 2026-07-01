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
 * @jest-environment node
 */

// Mock electron before any requires
jest.mock('electron', () => ({
  dialog: {
    showMessageBox: jest.fn(),
    showOpenDialog: jest.fn(() =>
      Promise.resolve({ canceled: false, filePaths: [] })
    ),
    showSaveDialog: jest.fn(() => Promise.resolve({ canceled: true })),
    showErrorBox: jest.fn()
  },
  Menu: {
    buildFromTemplate: jest.fn(() => ({})),
    setApplicationMenu: jest.fn()
  },
  shell: { openExternal: jest.fn() },
  BrowserWindow: {
    getAllWindows: jest.fn(() => [])
  },
  ipcMain: { on: jest.fn() },
  Tray: jest.fn(() => ({
    setContextMenu: jest.fn(),
    setToolTip: jest.fn(),
    on: jest.fn()
  })),
  nativeImage: { createFromPath: jest.fn(() => ({})) }
}))

// Mock sub-modules that pull in electron transitively
jest.mock('../src-electron/util/env', () => ({
  logBrowser: jest.fn(),
  iconsDirectory: jest.fn(() => '/icons'),
  logInfo: jest.fn(),
  logError: jest.fn()
}))

jest.mock('../src-electron/ui/ui-util', () => ({
  toggleDirtyFlag: jest.fn(),
  openFileDialogAndReportResult: jest.fn(),
  showErrorMessage: jest.fn(),
  openNewConfiguration: jest.fn(),
  openFileConfiguration: jest.fn()
}))

jest.mock('../src-electron/ui/window', () => ({
  windowCreate: jest.fn(),
  windowCreateIfNotThere: jest.fn(),
  initializeElectronUi: jest.fn()
}))

jest.mock('../src-electron/ui/tray', () => ({
  initTray: jest.fn()
}))

jest.mock('../src-electron/server/http-server', () => ({
  httpServerPort: jest.fn(() => 9070)
}))

const { timeout } = require('./test-util.js')

// ---------------------------------------------------------------------------
// src-electron/ui/browser-api.js — pure / low-dependency functions
// ---------------------------------------------------------------------------

describe('browser-api.js pure functions', () => {
  const browserApi = require('../src-electron/ui/browser-api.js')
  const rendApi = require('../src-shared/rend-api.js')

  test(
    'getUserKeyFromCookieValue returns null for null input',
    () => {
      expect(browserApi.getUserKeyFromCookieValue(null)).toBeNull()
    },
    timeout.short()
  )

  test(
    'getUserKeyFromCookieValue strips connect.sid= prefix',
    () => {
      const key = browserApi.getUserKeyFromCookieValue(
        'connect.sid=s%3Amysessionid.signature'
      )
      expect(key).toBe('mysessionid')
    },
    timeout.short()
  )

  test(
    'getUserKeyFromCookieValue strips s%3A prefix',
    () => {
      const key = browserApi.getUserKeyFromCookieValue('s%3Axyz.abc')
      expect(key).toBe('xyz')
    },
    timeout.short()
  )

  test(
    'getUserKeyFromCookieValue handles value with no special prefix',
    () => {
      const key = browserApi.getUserKeyFromCookieValue('plainvalue')
      expect(key).toBe('plainvalue')
    },
    timeout.short()
  )

  test(
    'getUserKeyFromBrowserCookie extracts connect.sid',
    () => {
      const key = browserApi.getUserKeyFromBrowserCookie({
        'connect.sid': 's%3Amysessionkey.hash'
      })
      expect(key).toBe('mysessionkey')
    },
    timeout.short()
  )

  test(
    'getUserKeyFromBrowserCookie returns null when no connect.sid present',
    () => {
      const key = browserApi.getUserKeyFromBrowserCookie({})
      expect(key).toBeNull()
    },
    timeout.short()
  )

  test(
    'processRendererNotify returns false for non-renderer messages',
    () => {
      const result = browserApi.processRendererNotify(
        {},
        'some plain log message'
      )
      expect(result).toBe(false)
    },
    timeout.short()
  )

  test(
    'processRendererNotify processes dirtyFlag notification',
    () => {
      const uiUtil = require('../src-electron/ui/ui-util')
      const fakeWindow = {}
      const msg =
        rendApi.jsonPrefix +
        JSON.stringify({ key: rendApi.notifyKey.dirtyFlag, value: true })
      const result = browserApi.processRendererNotify(fakeWindow, msg)
      expect(result).toBe(true)
      expect(uiUtil.toggleDirtyFlag).toHaveBeenCalledWith(fakeWindow, true)
    },
    timeout.short()
  )

  test(
    'processRendererNotify processes fileBrowse notification',
    () => {
      const uiUtil = require('../src-electron/ui/ui-util')
      const fakeWindow = {}
      const msg =
        rendApi.jsonPrefix +
        JSON.stringify({
          key: rendApi.notifyKey.fileBrowse,
          value: { mode: 'file' }
        })
      const result = browserApi.processRendererNotify(fakeWindow, msg)
      expect(result).toBe(true)
      expect(uiUtil.openFileDialogAndReportResult).toHaveBeenCalled()
    },
    timeout.short()
  )

  test(
    'processRendererNotify returns false for unknown renderer key',
    () => {
      const fakeWindow = {}
      const msg =
        rendApi.jsonPrefix +
        JSON.stringify({ key: 'unknownKey', value: 'data' })
      const result = browserApi.processRendererNotify(fakeWindow, msg)
      expect(result).toBe(false)
    },
    timeout.short()
  )

  test(
    'getRendererApiInformation builds formatted description string',
    async () => {
      const fakeWindow = {
        webContents: {
          executeJavaScript: jest.fn(() =>
            Promise.resolve({
              prefix: 'zap',
              description: 'Zap Renderer API',
              functions: [
                { id: 'save', description: 'Save file' },
                { id: 'open', description: 'Open file', type: 'observer' }
              ]
            })
          )
        }
      }
      const msg = await browserApi.getRendererApiInformation(fakeWindow)
      expect(msg).toContain('zap')
      expect(msg).toContain('save')
      expect(msg).toContain('observer')
    },
    timeout.short()
  )
})

// ---------------------------------------------------------------------------
// src-electron/ui/menu.js — exported functions
// ---------------------------------------------------------------------------

describe('menu.js exported functions', () => {
  let menu

  beforeEach(() => {
    jest.resetModules()
    // Re-apply mocks since we reset modules
    jest.mock('electron', () => ({
      dialog: {
        showMessageBox: jest.fn(),
        showOpenDialog: jest.fn(),
        showSaveDialog: jest.fn(),
        showErrorBox: jest.fn()
      },
      Menu: {
        buildFromTemplate: jest.fn(() => ({})),
        setApplicationMenu: jest.fn()
      },
      shell: { openExternal: jest.fn() },
      BrowserWindow: { getAllWindows: jest.fn(() => []) },
      ipcMain: { on: jest.fn() }
    }))
    menu = require('../src-electron/ui/menu.js')
  })

  test(
    'newConfiguration constant is a non-empty string',
    () => {
      expect(typeof menu.newConfiguration).toBe('string')
      expect(menu.newConfiguration.length).toBeGreaterThan(0)
    },
    timeout.short()
  )

  test(
    'initMenu calls Menu.buildFromTemplate and setApplicationMenu',
    () => {
      const { Menu } = require('electron')
      menu.initMenu(9070)
      expect(Menu.buildFromTemplate).toHaveBeenCalled()
      expect(Menu.setApplicationMenu).toHaveBeenCalled()
    },
    timeout.short()
  )

  test(
    'toggleMenu hides menu when currently shown',
    () => {
      const { Menu } = require('electron')
      // First call to initMenu to set menuIsShown = true
      menu.initMenu(9070)
      Menu.setApplicationMenu.mockClear()
      // toggleMenu should now hide it (set to null)
      menu.toggleMenu(9070)
      expect(Menu.setApplicationMenu).toHaveBeenCalledWith(null)
    },
    timeout.short()
  )

  test(
    'toggleMenu shows menu when currently hidden',
    () => {
      const { Menu } = require('electron')
      menu.initMenu(9070)
      menu.toggleMenu(9070) // hides
      Menu.setApplicationMenu.mockClear()
      Menu.buildFromTemplate.mockClear()
      menu.toggleMenu(9070) // shows again
      expect(Menu.buildFromTemplate).toHaveBeenCalled()
    },
    timeout.short()
  )
})
