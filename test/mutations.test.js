/**
 *
 *    Copyright (c) 2021 Silicon Labs
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

import ZapState from '../src/store/zap/state.js'
import { timeout } from './test-util.js'
const mutations = require('../src/store/zap/mutations.js')
const restApi = require('../src-shared/rest-api')

test(
  'updateInformationText',
  () => {
    let text = 'foobar'
    let state = ZapState()
    mutations.updateInformationText(state, text)
    expect(state.informationText).toEqual(text)
  },
  timeout.short()
)

test(
  'updateClusters',
  () => {
    let clusters = [
      { name: 'foo', domainName: 'bar' },
      { name: 'bar', domainName: 'bar' }
    ]
    let domains = ['bar']
    let state = ZapState()
    mutations.updateClusters(state, clusters)
    expect(state.clusters).toEqual(clusters)
    expect(state.domains).toEqual(domains)
  },
  timeout.short()
)

test(
  'updateSelectedCluster',
  () => {
    let cluster = 'foobar'
    let state = ZapState()
    mutations.updateSelectedCluster(state, cluster)
    expect(state.clustersView.selected).toEqual(cluster)
  },
  timeout.short()
)

test(
  'updateAttributeDefaults',
  () => {
    let selectionContext = {
      id: 0,
      listType: 'defaultValue',
      newDefaultValue: 'foo',
      defaultValueValidationIssues: []
    }
    let state = ZapState()
    mutations.updateAttributeDefaults(state, selectionContext)
    expect(state.attributeView.defaultValue[selectionContext.id]).toEqual(
      selectionContext.newDefaultValue
    )
    expect(
      state.attributeView.defaultValueValidationIssues[selectionContext.id]
    ).toEqual(selectionContext.defaultValueValidationIssues)
  },
  timeout.short()
)

test(
  'updateSelectedEndpoint',
  () => {
    let endpoint = 'foobar'
    let state = ZapState()
    mutations.updateSelectedEndpoint(state, endpoint)
    expect(state.endpointView.selectedEndpoint).toEqual(endpoint)
  },
  timeout.short()
)

test(
  'updateAttributes',
  () => {
    let attributes = ['foo', 'bar']
    let state = ZapState()
    mutations.updateAttributes(state, attributes)
    expect(state.attributes).toEqual(attributes)
  },
  timeout.short()
)

test(
  'updateCommands',
  () => {
    let commands = ['foo', 'bar']
    let state = ZapState()
    mutations.updateCommands(state, commands)
    expect(state.commands).toEqual(commands)
  },
  timeout.short()
)

test(
  'setCommandLists',
  () => {
    let data = { incoming: [1, 2, 3], outgoing: [4, 5, 6] }
    let state = ZapState()
    mutations.setCommandLists(state, data)
    expect(state.commandView.selectedIn).toEqual(data.incoming)
    expect(state.commandView.selectedOut).toEqual(data.outgoing)
  },
  timeout.short()
)

test(
  'initializeDefaultEndpoints',
  () => {
    let endpoints = [{ id: 0, endpointId: 1 }]
    let state = ZapState()
    mutations.initializeDefaultEndpoints(state, endpoints)
    expect(state.endpointView.endpointId[0]).toEqual(1)
  },
  timeout.short()
)

test(
  'addEndpoint',
  () => {
    let endpoints = { id: 0, endpointId: 1, endpointTypeRef: 'foo' }
    let state = ZapState()
    mutations.addEndpoint(state, endpoints)
    expect(state.endpointView.endpointType[0]).toEqual('foo')
  },
  timeout.short()
)

test(
  'updateEndpoint',
  () => {
    let endpoints = { id: 0, endpointId: 1, endpointTypeRef: 'foo' }
    let state = ZapState()
    mutations.addEndpoint(state, endpoints)
    let context = {
      id: 0,
      changes: [{ updatedKey: 'endpointType', value: 'bar' }]
    }
    mutations.updateEndpoint(state, context)
    expect(state.endpointView['endpointType'][0]).toEqual('bar')
  },
  timeout.short()
)

test(
  'initializeDefaultEndpointTypes',
  () => {
    let endpointTypes = [
      { id: 0, endpointId: 1, name: 'foo', deviceTypeRef: 'bar' }
    ]
    let state = ZapState()
    mutations.initializeDefaultEndpointsTypes(state, endpointTypes)
    expect(state.endpointTypeView.name[0]).toEqual(endpointTypes[0].name)
  },
  timeout.short()
)

test(
  'addEndpointType',
  () => {
    let endpointType = { id: 0, endpointId: 1, name: 'foo' }
    let state = ZapState()
    mutations.addEndpointType(state, endpointType)
    expect(state.endpointTypeView.name[0]).toEqual('foo')
  },
  timeout.short()
)

test(
  'Reset domain filter',
  () => {
    let state = ZapState()
    state.clusterManager.filter.label = 'blah'
    state.clusterManager.openDomains = { foo: 1, bar: 2, tuna: 3 }
    expect(Object.keys(state.clusterManager.openDomains).length).toEqual(3)
    expect(state.clusterManager.filter.label).toEqual('blah')
    mutations.resetFilters(state)
    expect(state.clusterManager.filter.label).toEqual(restApi.noFilter)
    expect(Object.keys(state.clusterManager.openDomains).length).toBe(0)
  },
  timeout.short()
)

test(
  'Set endpoint type attribute',
  () => {
    let state = ZapState()
    let eptAttr = {
      id: 5,
      included: true,
      singleton: true,
      bounded: false,
      includedReportable: true,
      defaultValue: '423',
      storageOption: 'ram',
      minInterval: 0,
      maxInterval: 532,
      reportableChange: 40
    }
    mutations.setEndpointTypeAttribute(state, eptAttr)
    expect(
      state.attributeView.selectedAttributes.find((a) => a == eptAttr.id)
    ).toBe(5)
    expect(
      state.attributeView.selectedSingleton.find((a) => a == eptAttr.id)
    ).toBe(5)
    expect(
      state.attributeView.selectedBounded.find((a) => a == eptAttr.id)
    ).toBeUndefined()
    expect(
      state.attributeView.selectedReporting.find((a) => a == eptAttr.id)
    ).toBe(5)
    expect(state.attributeView.defaultValue[eptAttr.id]).toBe('423')
    expect(state.attributeView.storageOption[eptAttr.id]).toBe('ram')
    expect(state.attributeView.reportingMin[eptAttr.id]).toBe(0)
    expect(state.attributeView.reportingMax[eptAttr.id]).toBe(532)
    expect(state.attributeView.reportableChange[eptAttr.id]).toBe(40)
  },
  timeout.short()
)

describe('Simple toggle and setter mutations', () => {
  test(
    'tab toggles flip boolean flags',
    () => {
      let state = ZapState()
      let preview = state.showPreviewTab
      mutations.togglePreviewTab(state)
      expect(state.showPreviewTab).toBe(!preview)

      let notif = state.showNotificationTab
      mutations.toggleNotificationTab(state)
      expect(state.showNotificationTab).toBe(!notif)

      let valid = state.showValidationTab
      mutations.toggleValidationTab(state)
      expect(state.showValidationTab).toBe(!valid)

      mutations.setShowValidationTab(state, true)
      expect(state.showValidationTab).toBe(true)

      let dev = state.showDevTools
      mutations.updateShowDevTools(state)
      expect(state.showDevTools).toBe(!dev)
    },
    timeout.short()
  )

  test(
    'value setters store their payload',
    () => {
      let state = ZapState()
      mutations.setValidationReport(state, { a: 1 })
      expect(state.validationReport).toEqual({ a: 1 })

      mutations.setQuery(state, 'q=1')
      expect(state.query).toBe('q=1')

      mutations.setAllPackages(state, [{ id: 1 }])
      expect(state.allPackages).toEqual([{ id: 1 }])

      mutations.updateAtomics(state, [{ name: 'int8u' }])
      expect(state.atomics).toEqual([{ name: 'int8u' }])

      mutations.updateFeatureMapAttribute(state, { id: 7 })
      expect(state.featureMapAttribute).toEqual({ id: 7 })

      mutations.updateEvents(state, [{ id: 1 }])
      expect(state.events).toEqual([{ id: 1 }])

      mutations.updateFeatures(state, [{ id: 2 }])
      expect(state.features).toEqual([{ id: 2 }])

      mutations.updateZclDeviceTypes(state, { a: {} })
      expect(state.zclDeviceTypes).toEqual({ a: {} })

      mutations.updateEndpointConfigs(state, [{ id: 3 }])
      expect(state.endpoints).toEqual([{ id: 3 }])

      mutations.setLeftDrawerState(state, true)
      expect(state.leftDrawerOpenState).toBe(true)

      mutations.setMiniState(state, true)
      expect(state.miniState).toBe(true)

      mutations.setDebugNavBar(state, true)
      expect(state.debugNavBar).toBe(true)

      mutations.setStandalone(state, true)
      expect(state.standalone).toBe(true)

      mutations.setMultiConfig(state, true)
      expect(state.isMultiConfig).toBe(true)

      mutations.updateNotificationCount(state, 5)
      expect(state.notificationCount).toBe(5)

      mutations.updateIsClusterOptionChanged(state, true)
      expect(state.isClusterOptionChanged).toBe(true)

      mutations.updateProjectPackages(state, [{ id: 9 }])
      expect(state.packages).toEqual([{ id: 9 }])
    },
    timeout.short()
  )
})

describe('Inclusion list mutation', () => {
  test(
    'adds and removes ids idempotently',
    () => {
      let state = ZapState()
      const ctx = {
        view: 'attributeView',
        listType: 'selectedAttributes',
        id: 42,
        added: true
      }
      mutations.updateInclusionList(state, ctx)
      expect(state.attributeView.selectedAttributes).toContain(42)
      // adding again does not duplicate
      mutations.updateInclusionList(state, ctx)
      expect(
        state.attributeView.selectedAttributes.filter((x) => x === 42).length
      ).toBe(1)
      // removing
      mutations.updateInclusionList(state, { ...ctx, added: false })
      expect(state.attributeView.selectedAttributes).not.toContain(42)
    },
    timeout.short()
  )
})

describe('Endpoint and endpoint type mutations', () => {
  test(
    'setDeviceTypeReference, selected endpoint type, and cluster list',
    () => {
      let state = ZapState()
      mutations.setDeviceTypeReference(state, {
        endpointTypeId: 1,
        deviceTypeRef: [10],
        deviceVersion: 2,
        deviceIdentifier: 99
      })
      expect(state.endpointTypeView.deviceTypeRef[1]).toEqual([10])
      expect(state.endpointTypeView.deviceVersion[1]).toBe(2)
      expect(state.endpointTypeView.deviceIdentifier[1]).toBe(99)

      mutations.updateSelectedEndpointType(state, 5)
      expect(state.endpointTypeView.selectedEndpointType).toBe(5)

      mutations.updateDeviceTypeClustersForSelectedEndpoint(state, ['c'])
      expect(
        state.endpointTypeView.deviceTypeClustersForSelectedEndpoint
      ).toEqual(['c'])

      mutations.setClusterList(state, { clients: [1], servers: [2] })
      expect(state.clustersView.selectedClients).toEqual([1])
      expect(state.clustersView.selectedServers).toEqual([2])
    },
    timeout.short()
  )

  test(
    'initialize, remove endpoint type and delete endpoint',
    () => {
      let state = ZapState()
      mutations.initializeEndpoints(state, [
        { id: 1, endpointId: 0x0001, endpointTypeRef: 7, networkId: 0 }
      ])
      expect(state.endpointView.endpointId[1]).toBe(0x0001)

      mutations.initializeEndpointTypes(state, [
        { id: 1, name: 'A', deviceTypeRef: [1], deviceVersion: 1 }
      ])
      expect(state.endpointTypeView.name[1]).toBe('A')

      mutations.removeEndpointType(state, { id: 1 })
      expect(state.endpointTypeView.name[1]).toBeUndefined()

      mutations.deleteEndpoint(state, { id: 1 })
      expect(state.endpointView.endpointId[1]).toBeUndefined()
      expect(state.endpointView.selectedEndpoint).toBeNull()
    },
    timeout.short()
  )
})

describe('Attribute, command, event and cluster list mutations', () => {
  test(
    'resetAttributeDefaults and setAttributeLists',
    () => {
      let state = ZapState()
      state.attributes = [{ id: 1, defaultValue: 'x' }]
      mutations.resetAttributeDefaults(state)
      expect(state.attributeView.storageOption[1]).toBe('ram')
      expect(state.attributeView.reportingMax[1]).toBe(65534)

      mutations.setAttributeLists(state, {
        included: [1],
        singleton: [],
        bounded: [],
        includedReportable: [1],
        defaultValue: { 1: '5' },
        storageOption: { 1: 'nvm' },
        minInterval: { 1: 2 },
        maxInterval: { 1: 100 },
        reportableChange: { 1: 3 }
      })
      expect(state.attributeView.selectedAttributes).toEqual([1])
      expect(state.attributeView.defaultValue[1]).toBe('5')
      expect(state.attributeView.storageOption[1]).toBe('nvm')
    },
    timeout.short()
  )

  test(
    'setEventLists, recommended, required lists',
    () => {
      let state = ZapState()
      mutations.setEventLists(state, [{ id: 1 }])
      expect(state.eventView.selectedEvents).toEqual([{ id: 1 }])

      mutations.setRecommendedClusterList(state, {
        recommendedClients: [1],
        recommendedServers: [2],
        optionalClients: [3],
        optionalServers: [4]
      })
      expect(state.clustersView.recommendedClients).toEqual([1])
      expect(state.clustersView.optionalServers).toEqual([4])

      mutations.setRequiredAttributesList(state, { requiredAttributes: [9] })
      expect(state.attributeView.requiredAttributes).toEqual([9])

      mutations.setRequiredCommandsList(state, { requiredCommands: [8] })
      expect(state.commandView.requiredCommands).toEqual([8])

      mutations.updateAttributeDefaults(state, {
        listType: 'defaultValue',
        id: 1,
        newDefaultValue: '7',
        defaultValueValidationIssues: [],
        isNull: false
      })
      expect(state.attributeView.defaultValue[1]).toBe('7')
    },
    timeout.short()
  )
})

describe('Options and session key value mutations', () => {
  test(
    'setOptions dedupes by category, setSelectedGenericOption and loaders',
    () => {
      let state = ZapState()
      mutations.setOptions(state, {
        option: 'coreSpecification',
        data: [
          {
            optionCategory: 'coreSpecification',
            optionCode: '1.0',
            optionLabel: '1.0'
          },
          {
            optionCategory: 'other',
            optionCode: 'x',
            optionLabel: 'x'
          }
        ]
      })
      expect(state.genericOptions.coreSpecification.length).toBe(1)

      mutations.setSelectedGenericOption(state, { key: 'k', value: 'v' })
      expect(state.selectedGenericOptions.k).toBe('v')

      mutations.initializeSessionKeyValues(state, [{ key: 'a', value: 'b' }])
      expect(state.selectedGenericOptions.a).toBe('b')

      mutations.loadSessionKeyValues(state, {
        data: [{ key: 'c', value: 'd' }]
      })
      expect(state.selectedGenericOptions.c).toBe('d')

      mutations.setDefaultUiMode(state, 'zigbee')
      expect(state.calledArgs.defaultUiMode).toBe('zigbee')
    },
    timeout.short()
  )
})

describe('Cluster manager filter mutations', () => {
  test(
    'domain open/close, filter strings and last selected domain',
    () => {
      let state = ZapState()
      mutations.setOpenDomain(state, { domainName: 'General', value: true })
      expect(state.clusterManager.openDomains.General).toBe(true)

      mutations.setFilterString(state, 'foo')
      expect(state.clusterManager.filterString).toBe('foo')

      mutations.setIndividualClusterFilterString(state, 'bar')
      expect(state.clusterManager.individualClusterFilterString).toBe('bar')

      mutations.setLastSelectedDomain(state, 'General')
      expect(state.clusterManager.lastSelectedDomain).toBe('General')

      mutations.clearLastSelectedDomain(state)
      expect(state.clusterManager.lastSelectedDomain).toBeNull()
    },
    timeout.short()
  )

  test(
    'doActionFilter and setDomainFilter open domains via filter fn',
    () => {
      let state = ZapState()
      state.domains = ['General', 'HVAC']
      const filter = {
        label: 'Enabled Clusters',
        domainFilterFn: () => true
      }
      mutations.doActionFilter(state, {
        filter,
        enabledClusters: []
      })
      expect(state.clusterManager.openDomains.General).toBe(true)
      expect(state.clusterManager.allDomainsCollapsed).toBe(false)

      state.clusterManager.filterString = ''
      mutations.setDomainFilter(state, {
        filter,
        enabledClusters: [],
        relevantClusters: [],
        deviceTypeRefsForSelectedEndpoint: [],
        deviceTypeClustersForSelectedEndpoint: []
      })
      expect(state.clusterManager.allDomainsCollapsed).toBe(false)
    },
    timeout.short()
  )
})

describe('Exceptions, studio and tutorial mutations', () => {
  test(
    'exceptions handling',
    () => {
      let state = ZapState()
      let before = state.isExceptionsExpanded
      mutations.expandedExceptionsToggle(state)
      expect(state.isExceptionsExpanded).toBe(!before)

      mutations.updateExceptions(state, 'boom')
      expect(state.exceptions).toContain('boom')

      mutations.toggleShowExceptionIcon(state, true)
      expect(state.showExceptionIcon).toBe(true)
    },
    timeout.short()
  )

  test(
    'studio uc component mutations',
    () => {
      let state = ZapState()
      mutations.updateUcComponentState(state, {
        ucComponents: [1],
        selectedUcComponents: [2]
      })
      expect(state.studio.ucComponents).toEqual([1])
      expect(state.studio.selectedUcComponents).toEqual([2])

      mutations.updateSelectedUcComponentState(state, {
        selectedUcComponents: [3]
      })
      expect(state.studio.selectedUcComponents).toEqual([3])

      // null is a no-op
      mutations.updateUcComponentState(state, null)
      expect(state.studio.selectedUcComponents).toEqual([3])

      mutations.loadZclClusterToUcComponentDependencyMap(state, [{ a: 1 }])
      expect(state.studio.zclSdkExtClusterToUcComponentMap).toEqual([{ a: 1 }])
    },
    timeout.short()
  )

  test(
    'tutorial and endpoint modal mutations',
    () => {
      let state = ZapState()
      expect(mutations.selectZapConfig(state, { id: 1 })).toBe(true)
      expect(state.selectedZapConfig).toEqual({ id: 1 })

      mutations.toggleEndpointModal(state, true)
      expect(state.showCreateModifyEndpoint).toBe(true)

      mutations.toggleCmpTutorial(state, true)
      expect(state.isCmpTutorialSelected).toBe(true)
      expect(state.isEndpointTutorialSelected).toBe(false)

      mutations.toggleEndpointTutorial(state, true)
      expect(state.isEndpointTutorialSelected).toBe(true)
      expect(state.isCmpTutorialSelected).toBe(false)

      mutations.toggleTutorial(state, false)
      expect(state.isTutorialRunning).toBe(false)
      expect(state.isEndpointTutorialSelected).toBe(false)

      mutations.triggerExpanded(state, true)
      expect(state.expanded).toBe(true)

      mutations.openReportTabInCluster(state, true)
      expect(state.showReportTabInCluster).toBe(true)

      mutations.setClusterDataForTutorial(state, { id: 1 })
      expect(state.clusterDataForTutorial).toEqual({ id: 1 })

      mutations.updateIsProfileIdShown(state, 0)
      expect(state.isProfileIdShown).toBe(false)
      mutations.updateIsProfileIdShown(state, 1)
      expect(state.isProfileIdShown).toBe(true)

      mutations.setDeviceTypeRefAndDeviceIdPair(state, {
        deviceTypeRef: 5,
        deviceIdentifier: 6
      })
      expect(state.deviceTypeRefAndDeviceIdPair).toEqual({
        deviceTypeRef: 5,
        deviceIdentifier: 6
      })

      mutations.toggleShowEndpoint(state, { id: 1, value: true })
      expect(state.showEndpointData[1]).toBe(true)

      mutations.setAllEndpointsData(state, {
        endpointId: 1,
        servers: [1],
        report: [2],
        attr: [3]
      })
      expect(state.allEndpointsData[1].id).toBe(1)
    },
    timeout.short()
  )
})

describe('Device type feature mutations', () => {
  test(
    'feature-related mutations set state',
    () => {
      let state = ZapState()
      mutations.updateDeviceTypeFeatures(state, [{ id: 1 }])
      expect(state.deviceTypeFeatures).toEqual([{ id: 1 }])

      mutations.setEnabledClusters(state, [1])
      expect(state.enabledClusters).toEqual([1])

      mutations.setRelevantClusters(state, [2])
      expect(state.relevantClusters).toEqual([2])

      mutations.setDeviceTypeFeatures(state, [{ featureId: 1 }])
      expect(state.featureView.deviceTypeFeatures).toEqual([{ featureId: 1 }])

      mutations.updateEnabledDeviceTypeFeatures(state, [1, 2])
      expect(state.featureView.enabledDeviceTypeFeatures).toEqual([1, 2])

      state.featureView.deviceTypeFeatures = [
        { featureMapAttributeId: 1, featureMapValue: 0 }
      ]
      mutations.updateFeatureMapAttributeOfDeviceTypeFeatures(state, {
        featureMapAttributeId: 1,
        featureMapValue: 7
      })
      expect(state.featureView.deviceTypeFeatures[0].featureMapValue).toBe(7)

      mutations.updateConformDataExists(state, true)
      expect(state.featureView.conformDataExists).toBe(true)

      mutations.setRequiredElements(state, {
        attributesToUpdate: { required: [1], notSupported: [2] },
        commandsToUpdate: { required: [3], notSupported: [4] },
        eventsToUpdate: { required: [5], notSupported: [6] }
      })
      expect(state.attributeView.mandatory).toEqual([1])
      expect(state.commandView.notSupported).toEqual([4])
      expect(state.eventView.mandatory).toEqual([5])
    },
    timeout.short()
  )
})
