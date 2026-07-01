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

// Notify is mocked so mixin/util methods that raise UI notifications can be
// exercised without a mounted Quasar app.
jest.mock('quasar', () => ({ Notify: { create: jest.fn() } }))

import { timeout } from './test-util.js'

const { Notify } = require('quasar')
const util = require('../src/util/util')
const CommonMixin = require('../src/util/common-mixin').default
const FeatureMixin = require('../src/util/feature-mixin').default
const EditableAttributesMixin =
  require('../src/util/editable-attributes-mixin').default

// getSmallestUnusedEndpointId relies on a lodash global (_) the same way the
// running app does; provide it for the test context.
global._ = require('lodash')

/**
 * Binds a mixin's methods and computed getters onto a plain context object so
 * they can be invoked directly with a mocked component `this`.
 * @param {*} mixin - the exported mixin object
 * @param {*} ctx - the context to bind onto
 * @returns the same ctx
 */
function bindMixin(mixin, ctx) {
  if (mixin.methods) {
    for (const [name, fn] of Object.entries(mixin.methods)) {
      ctx[name] = fn.bind(ctx)
    }
  }
  if (mixin.computed) {
    for (const [name, def] of Object.entries(mixin.computed)) {
      const getter = typeof def === 'function' ? def : def.get
      Object.defineProperty(ctx, name, {
        get: getter.bind(ctx),
        configurable: true
      })
    }
  }
  return ctx
}

/**
 * Builds a mocked Vue component context with a fully populated fake Vuex store
 * and stubbed helpers, then binds the mixins under test onto it.
 */
function buildCtx() {
  const ctx = {
    $q: { dark: { isActive: false } },
    $serverPost: jest.fn(() => Promise.resolve({ data: {} })),
    $serverPatch: jest.fn(() => Promise.resolve({ data: {} })),
    individualClusterFilterString: '',
    globalLists: [],
    $store: {
      dispatch: jest.fn(() => Promise.resolve({ status: 200 })),
      commit: jest.fn(),
      state: {
        zap: {
          standalone: false,
          isMultiConfig: false,
          selectedZapConfig: null,
          attributes: [
            {
              id: 11,
              name: 'FeatureMap',
              code: 0xfffc,
              side: 'server',
              value: '3'
            },
            { id: 12, name: 'ClusterRevision', code: 0xfffd, side: 'server' }
          ],
          features: [
            {
              featureId: 1,
              clusterRef: 100,
              bit: 0,
              code: 'AA',
              name: 'Alpha'
            },
            { featureId: 2, clusterRef: 100, bit: 1, code: 'BB', name: 'Beta' },
            { featureId: 3, clusterRef: 100, bit: 5, code: 'CC', name: 'Gamma' }
          ],
          featureMapAttribute: { id: 11, value: '3', clusterRef: 100 },
          featureView: {
            deviceTypeFeatures: [
              {
                featureId: 1,
                clusterRef: 100,
                conformance: 'M',
                deviceTypes: ['x']
              }
            ],
            enabledDeviceTypeFeatures: [1]
          },
          endpointTypeView: {
            selectedEndpointType: 42,
            deviceTypeRef: { 42: [7] },
            deviceTypeClustersForSelectedEndpoint: ['c1'],
            deviceVersion: 2
          },
          endpointView: {
            selectedEndpoint: 3,
            endpointId: { 3: '0x0001', 4: '0x0003', 5: '0x0002' },
            endpointType: { 3: 42, 4: 43 }
          },
          clusters: [
            { id: 100, name: 'OnOff', label: 'On/Off' },
            { id: 101, name: 'Level', label: 'Level' }
          ],
          clustersView: {
            selected: [{ id: 100, name: 'OnOff', label: 'On/Off' }],
            selectedClients: [100],
            selectedServers: [100]
          },
          clusterManager: { individualClusterFilterString: '' },
          zclDeviceTypes: { x: {} },
          packages: [{ pkg: { id: 9, category: 'matter' } }],
          attributeView: {
            mandatory: { 11: true },
            notSupported: { 12: true },
            selectedAttributes: [1, 2],
            nullValues: [],
            selectedSingleton: [],
            selectedBounded: [],
            storageOption: {},
            defaultValue: {},
            selectedReporting: [],
            reportingMin: {},
            reportingMax: {},
            reportableChange: {},
            defaultValueValidationIssues: { 11: [], 12: ['bad value'] }
          },
          commandView: { mandatory: {}, notSupported: {} },
          eventView: { mandatory: {}, notSupported: {} },
          genericOptions: {
            generator: [
              {
                optionCode: 'shareClusterStatesAcrossEndpoints',
                optionLabel: 'true'
              },
              {
                optionCode: 'disableUcComponentOnZclClusterUpdate',
                optionLabel: 'false'
              }
            ]
          },
          studio: {
            selectedUcComponents: [
              {
                id: 'studiocomproot-Zigbee-Cluster_Library-Common-zigbee_basic'
              }
            ],
            zclSdkExtClusterToUcComponentMap: [
              {
                entityCode: 'zigbee_on/off-server',
                value: '%extension-zigbee%zigbee_on_off'
              }
            ]
          }
        }
      }
    }
  }
  bindMixin(CommonMixin, ctx)
  bindMixin(FeatureMixin, ctx)
  bindMixin(EditableAttributesMixin, ctx)
  return ctx
}

describe('src/util/util.js remaining functions', () => {
  test(
    'cantorPair',
    () => {
      expect(util.cantorPair(0, 0)).toBe(0)
      expect(util.cantorPair(1, 2)).toBe(8)
      expect(util.cantorPair(3, 4)).toBe(32)
    },
    timeout.short()
  )

  test(
    'getSelectedUcComponents',
    () => {
      const list = [
        { id: 'a', isSelected: true },
        { id: 'b', isSelected: false },
        { id: 'c', isSelected: true }
      ]
      expect(util.getSelectedUcComponents(list).map((x) => x.id)).toEqual([
        'a',
        'c'
      ])
    },
    timeout.short()
  )

  test(
    'getUcComponents traverses children and filters by id prefix',
    () => {
      const tree = [
        {
          id: 'root',
          children: [
            { id: 'zigbee_basic' },
            { id: 'extension-matter' },
            { id: 'unrelated' }
          ]
        }
      ]
      const res = util.getUcComponents(tree).map((x) => x.id)
      expect(res).toContain('zigbee_basic')
      expect(res).toContain('extension-matter')
      expect(res).not.toContain('unrelated')
      expect(util.getUcComponents(null)).toEqual([])
    },
    timeout.short()
  )

  test(
    'notifyComponentUpdateStatus success and failure paths',
    () => {
      Notify.create.mockClear()
      // success path (all OK)
      util.notifyComponentUpdateStatus(
        [{ id: 'pre%zigbee_basic', status: 200 }],
        true
      )
      expect(Notify.create).toHaveBeenCalledTimes(1)

      // failure path with errors
      util.notifyComponentUpdateStatus(
        [
          {
            id: 'zigbee_on_off',
            status: 500,
            data: { errors: [{ basicMessage: 'boom' }] }
          }
        ],
        false
      )
      expect(Notify.create).toHaveBeenCalledTimes(2)

      // empty list => no notification
      util.notifyComponentUpdateStatus([], true)
      expect(Notify.create).toHaveBeenCalledTimes(2)
    },
    timeout.short()
  )

  test(
    'getServerRestPort reads restPort from query string',
    () => {
      const original = window.location
      delete window.location
      window.location = { search: '?restPort=9999' }
      expect(util.getServerRestPort()).toBe('9999')
      window.location = { search: '' }
      expect(util.getServerRestPort()).toBeNull()
      window.location = original
    },
    timeout.short()
  )
})

describe('common-mixin computed properties', () => {
  test(
    'store-backed computed getters resolve expected values',
    () => {
      const ctx = buildCtx()
      expect(ctx.isZapConfigSelected).toBe(false)
      expect(ctx.selectedEndpointTypeId).toBe(42)
      expect(ctx.endpointDeviceTypeRef).toEqual({ 42: [7] })
      expect(ctx.deviceTypeClustersForSelectedEndpoint).toEqual(['c1'])
      expect(ctx.endpointDeviceVersion).toBe(2)
      expect(ctx.selectedEndpointId).toBe(3)
      expect(ctx.endpointId).toEqual({ 3: '0x0001', 4: '0x0003', 5: '0x0002' })
      expect(ctx.endpointType).toEqual({ 3: 42, 4: 43 })
      expect(ctx.selectedCluster).toEqual({
        id: 100,
        name: 'OnOff',
        label: 'On/Off'
      })
      expect(ctx.selectedClusterId).toBe(100)
      expect(ctx.selectionClients).toEqual([100])
      expect(ctx.selectionServers).toEqual([100])
      expect(ctx.zclDeviceTypes).toEqual({ x: {} })
      expect(ctx.packages.length).toBe(1)
      expect(ctx.attributesRequiredByConform).toEqual({ 11: true })
      expect(ctx.attributesNotSupportedByConform).toEqual({ 12: true })
      expect(ctx.commandsRequiredByConform).toEqual({})
      expect(ctx.commandsNotSupportedByConform).toEqual({})
      expect(ctx.eventsRequiredByConform).toEqual({})
      expect(ctx.eventsNotSupportedByConform).toEqual({})
    },
    timeout.short()
  )

  test(
    'endpointIdListSorted sorts by hex endpoint id',
    () => {
      const ctx = buildCtx()
      const sorted = [...ctx.endpointIdListSorted.values()]
      expect(sorted).toEqual(['0x0001', '0x0002', '0x0003'])
    },
    timeout.short()
  )

  test(
    'endpointTypeIdList honors shareClusterStatesAcrossEndpoints',
    () => {
      const ctx = buildCtx()
      // share flag is true => returns all endpoint types
      expect(ctx.endpointTypeIdList).toEqual([42, 43])
    },
    timeout.short()
  )
})

describe('common-mixin methods', () => {
  test(
    'pure helper methods',
    () => {
      const ctx = buildCtx()
      expect(ctx.asHex(255, 4)).toBe('0x00FF')
      expect(ctx.hashAttributeIdClusterId(50, 50)).toBe(5100)
      expect(ctx.getAttributeById(11).name).toBe('FeatureMap')
      expect(ctx.sdkExtClusterCode({ entityCode: 7 })).toBe(7)
      expect(ctx.sdkExtClusterCode(null)).toBe('')
      expect(ctx.sdkExtUcComponentId({ value: 'v' })).toBe('v')
      expect(ctx.sdkExtUcComponentId(null)).toBe('')
      expect(ctx.standaloneMode()).toBe(false)
      expect(ctx.shareClusterStatesAcrossEndpoints()).toBe(true)
      expect(ctx.disableUcComponentOnZclClusterUpdate()).toBe(false)
    },
    timeout.short()
  )

  test(
    'getSmallestUnusedEndpointId finds first gap',
    () => {
      const ctx = buildCtx()
      // endpointId values are 0x0001, 0x0003, 0x0002 => 1,3,2 present, gap at 4
      expect(ctx.getSmallestUnusedEndpointId()).toBe(4)
    },
    timeout.short()
  )

  test(
    'createLogoSrc and getLogos',
    () => {
      const ctx = buildCtx()
      expect(ctx.createLogoSrc(false, 'zigbee')).toBe('/logo/zigbee_logo.svg')
      expect(ctx.createLogoSrc(true, 'matter', true)).toBe(
        '/logo/tiny/matter_logo_white.svg'
      )
      expect(ctx.createLogoSrc(false, null)).toBe('/logo/default_logo.svg')
      expect(ctx.getLogos([{ category: 'zigbee' }, {}])).toEqual([
        '/logo/zigbee_logo.svg',
        '/logo/zap_logo.png'
      ])
      expect(ctx.getLogos([])).toEqual(['/logo/zap_logo.png'])
    },
    timeout.short()
  )

  test(
    'getDeviceCategory single config',
    () => {
      const ctx = buildCtx()
      expect(ctx.getDeviceCategory(9)).toBe('matter')
    },
    timeout.short()
  )

  test(
    'ucComponentRequiredByCluster and missingUcComponentDependencies',
    () => {
      const ctx = buildCtx()
      const required = ctx.ucComponentRequiredByCluster(
        { id: 100, label: 'zigbee_on/off' },
        'server'
      )
      expect(required.length).toBe(1)
      const missing = ctx.missingUcComponentDependencies({
        id: 100,
        label: 'zigbee_on/off'
      })
      expect(Array.isArray(missing)).toBe(true)
    },
    timeout.short()
  )

  test(
    'setSelectedEndpointType and updateSelectedComponentRequest dispatch',
    () => {
      const ctx = buildCtx()
      ctx.setSelectedEndpointType(3)
      expect(ctx.$store.dispatch).toHaveBeenCalled()
      ctx.updateSelectedComponentRequest({ foo: 'bar' })
      expect(ctx.$store.dispatch).toHaveBeenCalledWith(
        'zap/updateSelectedComponent',
        { foo: 'bar' }
      )
    },
    timeout.short()
  )

  test(
    'setRequiredElementNotifications posts to server',
    () => {
      const ctx = buildCtx()
      ctx.setRequiredElementNotifications({ id: 11 }, true, 'attributes')
      expect(ctx.$serverPost).toHaveBeenCalled()
    },
    timeout.short()
  )
})

describe('feature-mixin methods and computed', () => {
  test(
    'getEnabledBitsFromFeatureMapValue',
    () => {
      const ctx = buildCtx()
      expect(ctx.getEnabledBitsFromFeatureMapValue(0)).toEqual([])
      expect(ctx.getEnabledBitsFromFeatureMapValue(3)).toEqual([0, 1])
      expect(ctx.getEnabledBitsFromFeatureMapValue(0b100001)).toEqual([0, 5])
    },
    timeout.short()
  )

  test(
    'featureIsEnabled and getFeatureMapBinary',
    () => {
      const ctx = buildCtx()
      expect(ctx.featureIsEnabled({ featureId: 2 }, [1, 2])).toBe(true)
      expect(ctx.featureIsEnabled({ featureId: 9 }, [1, 2])).toBe(false)
      // 3 features in store => padded to 3 bits
      expect(ctx.getFeatureMapBinary(5)).toBe('101')
    },
    timeout.short()
  )

  test(
    'featureMapValue and computed feature lists',
    () => {
      const ctx = buildCtx()
      expect(ctx.featureMapValue).toBe(3)
      expect(ctx.featureMapAttributeId).toBe(11)
      expect(ctx.featureMapAttribute.id).toBe(11)
      expect(ctx.deviceTypeFeatures.length).toBe(1)
      expect(ctx.enabledDeviceTypeFeatures).toEqual([1])
      // clusterFeatures maps store features and applies device type overrides
      const cf = ctx.clusterFeatures
      expect(cf.length).toBe(3)
      // enabledClusterFeatures returns featureIds whose bit is set in value 3 (bits 0,1)
      expect(ctx.enabledClusterFeatures).toEqual([1, 2])
    },
    timeout.short()
  )

  test(
    'noElementsToUpdate computed',
    () => {
      const ctx = buildCtx()
      ctx.attributesToUpdate = []
      ctx.commandsToUpdate = []
      ctx.eventsToUpdate = []
      expect(ctx.noElementsToUpdate).toBe(true)
      ctx.attributesToUpdate = [{ id: 1 }]
      expect(ctx.noElementsToUpdate).toBe(false)
    },
    timeout.short()
  )

  test(
    'buildFeatureMap for cluster and device type feature updates',
    () => {
      const ctx = buildCtx()
      // cluster feature update (no updatedFeature)
      const map = ctx.buildFeatureMap([1])
      expect(map).toEqual({ AA: true, BB: false, CC: false })

      // device type feature update path (updatedFeature provided)
      const map2 = ctx.buildFeatureMap([2], {
        featureId: 1,
        clusterRef: 100,
        bit: 0
      })
      expect(map2.BB).toBe(true)
    },
    timeout.short()
  )

  test(
    'processElementsForDialog and getClusterDataByRef',
    () => {
      const ctx = buildCtx()
      const res = ctx.processElementsForDialog([
        { name: 'X', value: true },
        { name: 'Y', value: false }
      ])
      expect(res).toContain('enable X')
      expect(res).toContain('disable Y')
      expect(ctx.processElementsForDialog(null)).toEqual([])
      expect(ctx.getClusterDataByRef(100).name).toBe('OnOff')
    },
    timeout.short()
  )

  test(
    'displayPopUpWarnings normalizes to array and notifies',
    () => {
      const ctx = buildCtx()
      Notify.create.mockClear()
      ctx.displayPopUpWarnings('single warning')
      expect(Notify.create).toHaveBeenCalledTimes(1)
      ctx.displayPopUpWarnings(['a', 'b'])
      expect(Notify.create).toHaveBeenCalledTimes(3)
    },
    timeout.short()
  )

  test(
    'updateFeatureMapAttribute and setRequiredConformElement dispatch',
    () => {
      const ctx = buildCtx()
      ctx.updateFeatureMapAttribute(0)
      expect(ctx.$serverPatch).toHaveBeenCalled()
      expect(ctx.$store.commit).toHaveBeenCalled()
      ctx.setRequiredConformElement()
      expect(ctx.$store.dispatch).toHaveBeenCalledWith(
        'zap/setRequiredElements',
        expect.any(Object)
      )
    },
    timeout.short()
  )
})

describe('editable-attributes-mixin methods and computed', () => {
  test(
    'computed getters resolve from attributeView',
    () => {
      const ctx = buildCtx()
      expect(ctx.selection).toEqual([1, 2])
      expect(ctx.nullValues).toEqual([])
      expect(ctx.selectionSingleton).toEqual([])
      expect(ctx.selectionBounded).toEqual([])
      expect(ctx.selectionStorageOption).toEqual({})
      expect(ctx.selectionDefault).toEqual({})
      expect(ctx.selectedReporting).toEqual([])
      expect(ctx.selectionMin).toEqual({})
      expect(ctx.selectionMax).toEqual({})
      expect(ctx.selectionReportableChange).toEqual({})
      expect(ctx.defaultValueValidation).toEqual({ 11: [], 12: ['bad value'] })
      expect(ctx.individualClusterFilterString).toBe('')
    },
    timeout.short()
  )

  test(
    'relevantAttributeData filters by side selection',
    () => {
      const ctx = buildCtx()
      const res = ctx.relevantAttributeData
      // both attributes are server side and cluster 100 is a selected server
      expect(res.map((a) => a.id).sort()).toEqual([11, 12])
    },
    timeout.short()
  )

  test(
    'isDefaultValueValid and getDefaultValueErrorMessage',
    () => {
      const ctx = buildCtx()
      expect(ctx.isDefaultValueValid(11)).toBe(true)
      expect(ctx.isDefaultValueValid(12)).toBe(false)
      expect(ctx.isDefaultValueValid(999)).toBe(true)
      expect(ctx.getDefaultValueErrorMessage(12)).toContain('bad value')
      expect(ctx.getDefaultValueErrorMessage(999)).toBe('')
    },
    timeout.short()
  )

  test(
    'initializeBooleanEditableList adds and removes',
    () => {
      const ctx = buildCtx()
      let editable = []
      ctx.initializeBooleanEditableList([5], editable, 5)
      expect(editable).toEqual([5])
      // already present, should not duplicate
      ctx.initializeBooleanEditableList([5], editable, 5)
      expect(editable).toEqual([5])
      // not in originating list => remove
      ctx.initializeBooleanEditableList([], editable, 5)
      expect(editable).toEqual([])
    },
    timeout.short()
  )

  test(
    'initializeTextEditableList copies value',
    () => {
      const ctx = buildCtx()
      let editable = {}
      ctx.initializeTextEditableList({ 7: 'hello' }, editable, 7)
      expect(editable[7]).toBe('hello')
    },
    timeout.short()
  )

  test(
    'setAttributeSelection and handleLocalSelection dispatch update',
    () => {
      const ctx = buildCtx()
      ctx.setAttributeSelection(
        true,
        'selectedAttributes',
        { id: 11, side: 'server' },
        100
      )
      expect(ctx.$store.dispatch).toHaveBeenCalledWith(
        'zap/updateSelectedAttribute',
        expect.objectContaining({ id: 11, value: true })
      )
      ctx.handleLocalSelection([5100], 'selectedAttributes', { id: 51 }, 51)
      expect(ctx.$store.dispatch).toHaveBeenCalled()
    },
    timeout.short()
  )

  test(
    'handleAttributeDefaultChange warns on featureMap and dispatches',
    () => {
      const ctx = buildCtx()
      Notify.create.mockClear()
      ctx.handleAttributeDefaultChange(
        '5',
        'defaultValue',
        { id: 11, code: 0xfffc, side: 'server' },
        100
      )
      expect(Notify.create).toHaveBeenCalled()
      expect(ctx.$store.dispatch).toHaveBeenCalledWith(
        'zap/updateSelectedAttribute',
        expect.any(Object)
      )
      ctx.handleLocalChange('7', 'defaultValue', { id: 12, code: 1 }, 100)
      expect(ctx.$store.dispatch).toHaveBeenCalled()
    },
    timeout.short()
  )

  test(
    'toggleAttributeSelection toggles and enables reporting',
    () => {
      const ctx = buildCtx()
      ctx.toggleAttributeSelection(
        [],
        'selectedAttributes',
        { id: 11, side: 'server', isReportable: true },
        100
      )
      expect(ctx.$store.dispatch).toHaveBeenCalled()
      expect(ctx.$serverPost).toHaveBeenCalled()
    },
    timeout.short()
  )

  test(
    'edit/reset attribute dispatchers',
    () => {
      const ctx = buildCtx()
      ctx.setEditableAttribute({ id: 11, side: 'server' }, 100)
      ctx.setEditableAttributeReporting(11, 100)
      ctx.resetAttributeReporting(11)
      ctx.resetAttribute(11)
      expect(ctx.$store.dispatch).toHaveBeenCalled()
    },
    timeout.short()
  )

  test(
    'sort helpers',
    () => {
      const ctx = buildCtx()
      expect(ctx.sortByText('a', 'b')).toBe(-1)
      expect(ctx.sortByText('b', 'a')).toBe(1)
      expect(ctx.sortByText('a', 'a', 1, 2, (i, j) => i - j)).toBe(-1)

      const singletonList = [ctx.hashAttributeIdClusterId(1, 100)]
      expect(ctx.sortByBoolean({ id: 1 }, { id: 2 }, 0, 0, singletonList)).toBe(
        1
      )
      expect(ctx.sortByBoolean({ id: 2 }, { id: 1 }, 0, 0, singletonList)).toBe(
        -1
      )

      expect(
        ctx.sortByClusterAndManufacturerCode(
          { manufacturerCode: 1, code: 2 },
          { manufacturerCode: 1, code: 1 }
        )
      ).toBe(1)
      expect(
        ctx.sortByClusterAndManufacturerCode(
          { manufacturerCode: 2, code: 1 },
          { manufacturerCode: 1, code: 1 }
        )
      ).toBe(1)
    },
    timeout.short()
  )
})
