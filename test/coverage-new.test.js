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

jest.mock('quasar', () => ({
  Notify: { create: jest.fn() },
  Dark: { set: jest.fn() }
}))

jest.mock('axios', () => ({
  get: jest.fn(() => Promise.resolve({ status: 200, data: {} })),
  post: jest.fn(() => Promise.resolve({ status: 200, data: {} })),
  put: jest.fn(() => Promise.resolve({ status: 200, data: {} })),
  patch: jest.fn(() => Promise.resolve({ status: 200, data: {} })),
  delete: jest.fn(() => Promise.resolve({ status: 200, data: {} }))
}))

import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-jest'
import { shallowMount } from '@vue/test-utils'
import PackagesList from '../src/components/PackagesList.vue'
import ZapStore from '../src/store/index.js'
import { timeout } from './test-util.js'

installQuasarPlugin()

// ---------------------------------------------------------------------------
// PackagesList.vue — methods
// ---------------------------------------------------------------------------

const samplePackages = [
  {
    pkg: {
      id: 10,
      path: '/home/user/project/my-package.zcl',
      type: 'zcl-properties',
      version: '1.0'
    },
    sessionPackage: { required: false }
  },
  {
    pkg: {
      id: 11,
      path: '/another/path.json',
      type: 'gen-templates-json',
      version: '2.0'
    },
    sessionPackage: { required: true }
  }
]

describe('PackagesList.vue methods', () => {
  let wrapper

  beforeEach(() => {
    wrapper = shallowMount(PackagesList, {
      global: { plugins: [ZapStore()] },
      props: {
        packages: samplePackages,
        builtIn: false,
        notisData: {
          10: { hasError: true },
          11: { hasWarning: true }
        }
      }
    })
  })

  test(
    'renders without errors',
    () => {
      expect(wrapper.html().length).toBeGreaterThan(10)
    },
    timeout.short()
  )

  test(
    'iconName returns error when hasError is set',
    () => {
      expect(wrapper.vm.iconName(10)).toBe('error')
    },
    timeout.short()
  )

  test(
    'iconName returns warning when hasWarning is set',
    () => {
      expect(wrapper.vm.iconName(11)).toBe('warning')
    },
    timeout.short()
  )

  test(
    'iconName returns check_circle for clean package',
    () => {
      expect(wrapper.vm.iconName(99)).toBe('check_circle')
    },
    timeout.short()
  )

  test(
    'iconColor returns red for error',
    () => {
      expect(wrapper.vm.iconColor(10)).toBe('red')
    },
    timeout.short()
  )

  test(
    'iconColor returns orange for warning',
    () => {
      expect(wrapper.vm.iconColor(11)).toBe('orange')
    },
    timeout.short()
  )

  test(
    'iconColor returns green for clean package',
    () => {
      expect(wrapper.vm.iconColor(99)).toBe('green')
    },
    timeout.short()
  )

  test(
    'handleIconClick sets dialogData for error icon',
    () => {
      wrapper.vm.handleIconClick(10)
      expect(wrapper.vm.dialogData[10]).toBe(true)
    },
    timeout.short()
  )

  test(
    'handleIconClick does not set dialogData for clean icon',
    () => {
      wrapper.vm.handleIconClick(99)
      expect(wrapper.vm.dialogData[99]).toBeUndefined()
    },
    timeout.short()
  )

  test(
    'getFileName extracts filename from path',
    () => {
      expect(wrapper.vm.getFileName('/home/user/project/my-package.zcl')).toBe(
        'my-package.zcl'
      )
    },
    timeout.short()
  )

  test(
    'getFileName returns path when no slash present',
    () => {
      expect(wrapper.vm.getFileName('justfilename.zap')).toBe(
        'justfilename.zap'
      )
    },
    timeout.short()
  )

  test(
    'deletePackage dispatches store actions',
    async () => {
      const dispatch = jest.fn(() => Promise.resolve())
      wrapper.vm.$store.dispatch = dispatch
      await wrapper.vm.deletePackage(samplePackages[0])
      expect(dispatch).toHaveBeenCalledWith(
        'zap/deleteSessionPackage',
        samplePackages[0].sessionPackage
      )
      expect(dispatch).toHaveBeenCalledWith('zap/updateClusters')
      expect(dispatch).toHaveBeenCalledWith('zap/updateAtomics')
    },
    timeout.short()
  )
})

// ---------------------------------------------------------------------------
// src/store/zap/state.js — clusterManager filter closure functions
// ---------------------------------------------------------------------------

describe('ZapState clusterManager filter functions', () => {
  let state

  beforeEach(() => {
    const ZapState = require('../src/store/zap/state.js').default
    state = ZapState()
  })

  test(
    'default filter domainFilterFn returns whether domain is in openDomains',
    () => {
      const filterFn = state.clusterManager.filter.domainFilterFn
      expect(filterFn('Lighting', { Lighting: true }, {})).toBe(true)
      expect(filterFn('Lighting', {}, {})).toBeFalsy()
    },
    timeout.short()
  )

  test(
    'filterOptions[0] (noFilter) domainFilterFn checks openDomains',
    () => {
      const fn = state.clusterManager.filterOptions[0].domainFilterFn
      expect(fn('General', { General: true }, {})).toBe(true)
      expect(fn('General', {}, {})).toBeFalsy()
    },
    timeout.short()
  )

  test(
    'filterOptions[1] (All Clusters) domainFilterFn always returns true',
    () => {
      const fn = state.clusterManager.filterOptions[1].domainFilterFn
      expect(fn('AnyDomain', {}, {})).toBe(true)
    },
    timeout.short()
  )

  test(
    'filterOptions[2] (Enabled Clusters) domainFilterFn checks enabledClusters',
    () => {
      const fn = state.clusterManager.filterOptions[2].domainFilterFn
      const ctx = { enabledClusters: [{ id: 1, domainName: 'Lighting' }] }
      expect(fn('Lighting', {}, ctx)).toBe(true)
      expect(fn('General', {}, ctx)).toBe(false)
    },
    timeout.short()
  )

  test(
    'filterOptions[2] (Enabled Clusters) clusterFilterFn checks if cluster is enabled',
    () => {
      const fn = state.clusterManager.filterOptions[2].clusterFilterFn
      const ctx = { enabledClusters: [{ id: 5 }] }
      expect(fn({ id: 5 }, ctx)).toBe(true)
      expect(fn({ id: 9 }, ctx)).toBe(false)
    },
    timeout.short()
  )

  test(
    'filterOptions[3] (Legal Clusters) domainFilterFn checks deviceType cluster refs',
    () => {
      const fn = state.clusterManager.filterOptions[3].domainFilterFn
      const ctx = {
        deviceTypeClustersForSelectedEndpoint: [{ clusterRef: 10 }],
        relevantClusters: [{ id: 10, domainName: 'Lighting' }]
      }
      expect(fn('Lighting', {}, ctx)).toBe(true)
      expect(fn('General', {}, ctx)).toBe(false)
    },
    timeout.short()
  )

  test(
    'filterOptions[3] (Legal Clusters) clusterFilterFn checks legal cluster ids',
    () => {
      const fn = state.clusterManager.filterOptions[3].clusterFilterFn
      const ctx = {
        deviceTypeClustersForSelectedEndpoint: [{ clusterRef: 10 }],
        relevantClusters: [{ id: 10 }]
      }
      expect(fn({ id: 10 }, ctx)).toBe(true)
      expect(fn({ id: 99 }, ctx)).toBe(false)
    },
    timeout.short()
  )

  test(
    'actionOptions[0] (Close All) domainFilterFn always returns false',
    () => {
      const fn = state.clusterManager.actionOptions[0].domainFilterFn
      expect(fn('AnyDomain', { AnyDomain: true }, {})).toBe(false)
    },
    timeout.short()
  )

  test(
    'actionOptions[1] (Open All) domainFilterFn always returns true',
    () => {
      const fn = state.clusterManager.actionOptions[1].domainFilterFn
      expect(fn('AnyDomain', {}, {})).toBe(true)
    },
    timeout.short()
  )
})

// ---------------------------------------------------------------------------
// src/boot/axios.js — HTTP helper functions
// ---------------------------------------------------------------------------

describe('axios.js HTTP functions', () => {
  let axiosMock
  let axiosRequests

  beforeEach(() => {
    jest.resetModules()
    axiosMock = require('axios')
    axiosMock.get.mockResolvedValue({ status: 200, data: { result: 'ok' } })
    axiosMock.post.mockResolvedValue({ status: 200, data: { result: 'ok' } })
    axiosMock.put.mockResolvedValue({ status: 200, data: { result: 'ok' } })
    axiosMock.patch.mockResolvedValue({ status: 200, data: { result: 'ok' } })
    axiosMock.delete.mockResolvedValue({ status: 200, data: { result: 'ok' } })
    const mod = require('../src/boot/axios')
    axiosRequests = mod.axiosRequests
  })

  test(
    '$serverGet calls axios.get and returns response',
    async () => {
      const res = await axiosRequests.$serverGet('/test/url')
      expect(axiosMock.get).toHaveBeenCalled()
      expect(res.status).toBe(200)
    },
    timeout.short()
  )

  test(
    '$serverPost calls axios.post and returns response',
    async () => {
      const res = await axiosRequests.$serverPost('/test/url', { key: 'val' })
      expect(axiosMock.post).toHaveBeenCalled()
      expect(res.status).toBe(200)
    },
    timeout.short()
  )

  test(
    '$serverPut calls axios.put and returns response',
    async () => {
      const res = await axiosRequests.$serverPut('/test/url', { key: 'val' })
      expect(axiosMock.put).toHaveBeenCalled()
      expect(res.status).toBe(200)
    },
    timeout.short()
  )

  test(
    '$serverPatch calls axios.patch and returns response',
    async () => {
      const res = await axiosRequests.$serverPatch('/test/url', { key: 'val' })
      expect(axiosMock.patch).toHaveBeenCalled()
      expect(res.status).toBe(200)
    },
    timeout.short()
  )

  test(
    '$serverDelete calls axios.delete and returns response',
    async () => {
      const res = await axiosRequests.$serverDelete('/test/url')
      expect(axiosMock.delete).toHaveBeenCalled()
      expect(res.status).toBe(200)
    },
    timeout.short()
  )

  test(
    '$serverPost handles error response by calling Notify.create',
    async () => {
      const { Notify } = require('quasar')
      Notify.create.mockClear()
      axiosMock.post.mockRejectedValueOnce({
        message: 'Network Error',
        response: { status: 500, data: { message: 'Server error' } }
      })
      await axiosRequests.$serverPost('/fail/url', {})
      expect(Notify.create).toHaveBeenCalled()
    },
    timeout.short()
  )

  test(
    '$serverPatch handles error response by calling Notify.create',
    async () => {
      const { Notify } = require('quasar')
      Notify.create.mockClear()
      axiosMock.patch.mockRejectedValueOnce({
        message: 'Network Error',
        response: { status: 500, data: { message: 'Patch failed' } }
      })
      await axiosRequests.$serverPatch('/fail/url', {})
      expect(Notify.create).toHaveBeenCalled()
    },
    timeout.short()
  )

  test(
    '$serverGet with custom restPort rewrites URL to localhost',
    async () => {
      delete window.location
      window.location = {
        search: '?restPort=9876',
        hostname: 'localhost',
        port: ''
      }
      jest.resetModules()
      const mod2 = require('../src/boot/axios')
      const freshAxios = require('axios')
      freshAxios.get.mockResolvedValue({ status: 200, data: {} })
      await mod2.axiosRequests.$serverGet('/some/endpoint')
      expect(freshAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('9876'),
        expect.any(Object)
      )
    },
    timeout.short()
  )
})
