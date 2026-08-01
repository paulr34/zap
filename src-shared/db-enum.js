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
 */

/**
 * This module provides mappings between database columns and JS keys.
 *
 * @module DB API: DB types and enums.
 */

exports.packageType = {
  zclProperties: 'zcl-properties',
  zclXml: 'zcl-xml-child',
  zclXmlStandalone: 'zcl-xml-standalone',
  sqlSchema: 'sql-schema',
  zclSchema: 'zcl-schema',
  genTemplatesJson: 'gen-templates-json',
  genSingleTemplate: 'gen-template',
  genHelper: 'gen-helper',
  genOverride: 'gen-override',
  genPartial: 'gen-partial',
  jsonExtension: 'json-extension'
}

exports.rootNode = {
  endpointId: 0,
  getParentEndpointIdentifier: null,
  deviceVersion: 1,
  type: 'rootNode',
  profileID: 259
}

exports.packageOptionCategory = {
  manufacturerCodes: 'manufacturerCodes',
  typeMap: 'typeMap',
  generator: 'generator',
  profileCodes: 'profileCodes',
  validationTimersFlags: 'validationTimersFlags',
  ui: 'ui',
  helperCategories: 'helperCategories',
  helperAliases: 'helperAliases',
  resources: 'resources',
  outputOptions: 'outputOptions'
}

// these are allowed values for the value of "iterator" for
// the individual template in a templates.json file.
// Note: if you add more of these, add the documentation to sdk-integration.md
exports.iteratorValues = {
  availableCluster: 'availableCluster',
  selectedCluster: 'selectedCluster',
  selectedClientCluster: 'selectedClientCluster',
  selectedServerCluster: 'selectedServerCluster'
}

exports.side = {
  client: 'client',
  server: 'server',
  either: 'either',
  both: 'both'
}
exports.source = {
  client: 'client',
  server: 'server'
}

exports.storageOption = {
  ram: 'RAM',
  nvm: 'NVM',
  external: 'External'
}

exports.composition = {
  fullFamily: 'fullFamily',
  tree: 'tree',
  rootNode: 'rootNode'
}

exports.zclType = {
  struct: 'struct',
  enum: 'enum',
  bitmap: 'bitmap',
  atomic: 'atomic',
  unknown: 'unknown',
  array: 'array',
  zclCharFormatter: 'zclCharFormatter',
  string: 'string',
  number: 'number'
}

exports.sessionKey = {
  filePath: 'filePath',
  ideProjectPath: 'ideProjectPath',
  informationText: 'informationText',
  disableComponentToggling: 'disableComponentToggling',
  generateStaticTemplates: 'generateStaticTemplates'
}

exports.pathRelativity = {
  relativeToZap: 'relativeToZap',
  relativeToUserHome: 'relativeToHome',
  absolute: 'absolute',
  resolveEnvVars: 'resolveEnvVars'
}

exports.wsCategory = {
  generic: 'generic',
  dirtyFlag: 'dirtyFlag',
  upgrade: 'upgrade',
  validation: 'validation',
  notificationCount: 'notificationCount',
  notificationInfo: 'notificationInfo',
  sessionCreationError: 'sessionCreationError',
  componentUpdateStatus: 'componentUpdateStatus',
  updateSelectedUcComponents: 'updateSelectedUcComponents',
  init: 'init',
  tick: 'tick'
}

exports.packageExtensionEntity = {
  cluster: 'cluster',
  command: 'command',
  attribute: 'attribute',
  attributeType: 'attributeType',
  deviceType: 'deviceType',
  event: 'event'
}

exports.generatorOptions = {
  postProcessMulti: 'postProcessMulti',
  postProcessSingle: 'postProcessSingle',
  routeErrToOut: 'routeErrToOut',
  postProcessConditionalFile: 'postProcessConditionalFile',
  enabled: 'enabled',
  shareClusterStatesAcrossEndpoints: 'shareClusterStatesAcrossEndpoints',
  disableUcComponentOnZclClusterUpdate: 'disableUcComponentOnZclClusterUpdate',
  generateStaticTemplates: 'generateStaticTemplates'
}

exports.sessionOption = {
  defaultResponsePolicy: 'defaultResponsePolicy',
  manufacturerCodes: 'manufacturerCodes',
  profileCodes: 'profileCodes',
  coreSpecification: 'coreSpecification',
  clusterSpecification: 'clusterSpecification',
  deviceTypeSpecification: 'deviceTypeSpecification'
}

const reportingPolicy = {
  mandatory: 'mandatory',
  suggested: 'suggested',
  optional: 'optional',
  prohibited: 'prohibited',
  defaultReportingPolicy: 'optional',
  resolve: (txt) => {
    switch (txt) {
      case reportingPolicy.mandatory:
      case reportingPolicy.optional:
      case reportingPolicy.suggested:
      case reportingPolicy.prohibited:
        return txt
      default:
        // Default
        return reportingPolicy.defaultReportingPolicy
    }
  }
}

exports.reportingPolicy = reportingPolicy

const storagePolicy = {
  // Allow any storage policy to be used in the UI
  any: 'any',
  // Must use external storage and bypasses attribute store altogether.
  attributeAccessInterface: 'attributeAccessInterface',
  // Must use external storage, but the default value still comes from ZAP.
  // The implementation of the cluster holds the value and reads the default
  // once, so there is nothing to store but there is something to generate.
  defaultOnly: 'defaultOnly',
  resolve: (txt) => {
    switch (txt) {
      case storagePolicy.any:
      case storagePolicy.attributeAccessInterface:
      case storagePolicy.defaultOnly:
        return txt
      default:
        return storagePolicy.any
    }
  }
}

exports.storagePolicy = storagePolicy

/**
 * Who implements a cluster. An ember cluster stores its attributes in the
 * attribute store that ZAP generates. A code driven cluster implements
 * ServerClusterInterface and holds its own state, so the attribute store has
 * nothing to do for it.
 */
const clusterImplementation = {
  ember: 'ember',
  codeDriven: 'code-driven',
  resolve: (txt) => {
    switch (txt) {
      case clusterImplementation.codeDriven:
      case clusterImplementation.ember:
        return txt
      default:
        return clusterImplementation.ember
    }
  }
}

exports.clusterImplementation = clusterImplementation

/**
 * What a cluster implementation needs from ZAP for one of its attributes.
 * These are the values that an SDK writes in its cluster implementation
 * metadata; they map onto the storage policies above.
 */
const attributeHandling = {
  // The user picks the storage, as usual.
  any: 'any',
  // ZAP provides the default value, the implementation holds the value.
  defaultOnly: 'default-only',
  // The implementation provides both, ZAP provides nothing.
  internal: 'internal',
  resolve: (txt) => {
    switch (txt) {
      case attributeHandling.any:
      case attributeHandling.defaultOnly:
      case attributeHandling.internal:
        return txt
      default:
        return null
    }
  },
  toStoragePolicy: (txt) => {
    switch (txt) {
      case attributeHandling.defaultOnly:
        return storagePolicy.defaultOnly
      case attributeHandling.internal:
        return storagePolicy.attributeAccessInterface
      default:
        return storagePolicy.any
    }
  }
}

exports.attributeHandling = attributeHandling

// When SDK supports a custom device, these are the default values for it.
exports.customDevice = {
  domain: 'Custom',
  name: 'Custom ZCL Device Type',
  description: 'Custom ZCL device type supports any combination of clusters.',
  code: 0xffff,
  profileId: 0xffff
}

exports.helperCategory = {
  zigbee: 'zigbee',
  matter: 'matter',
  meta: 'meta'
}

exports.slcArgs = {
  sdkRoot: 'sdkRoot',
  apackRoot: 'apackRoot',
  partOpn: 'partOpn',
  boards: 'boards',
  zigbeeZclJsonFile: 'zcl.zigbeeZclJsonFile',
  zigbeeTemplateJsonFile: 'zcl.zigbeeTemplateJsonFile',
  matterZclJsonFile: 'zcl.matterZclJsonFile',
  matterTemplateJsonFile: 'zcl.matterTemplateJsonFile'
}

exports.packageMatch = {
  fuzzy: 'fuzzy', // This mechanism will attempt to match the ones from zap file, then give up and do fuzzy match if it fails.
  strict: 'strict', // This mechanism will ONLY use the records of packages in the .zap file.
  ignore: 'ignore' // This mechanism will completely ignore the use of packages in the .zap file.
}

exports.feature = {
  name: {
    status: 'status',
    enabled: 'enabled',
    deviceType: 'deviceType',
    cluster: 'cluster',
    clusterSide: 'clusterSide',
    featureName: 'featureName',
    code: 'code',
    conformance: 'conformance',
    bit: 'bit',
    description: 'description'
  },
  label: {
    status: '',
    enabled: 'Enabled',
    deviceType: 'Device Type',
    cluster: 'Cluster',
    clusterSide: 'Cluster Side',
    featureName: 'Feature Name',
    code: 'Code',
    conformance: 'Conformance',
    bit: 'Bit',
    description: 'Description'
  }
}

exports.featureMapAttribute = {
  name: 'FeatureMap',
  code: 65532
}

exports.conformanceTag = {
  mandatory: 'M',
  optional: 'O',
  provisional: 'P',
  disallowed: 'X',
  deprecated: 'D',
  described: 'desc'
}

exports.conformanceVal = {
  mandatory: 'mandatory',
  optional: 'optional',
  provisional: 'provisional',
  disallowed: 'disallowed',
  deprecated: 'deprecated',
  described: 'described conformance that cannot be displayed as an expression',
  notSupported: 'notSupported'
}

exports.clusterSide = {
  client: 'client',
  server: 'server'
}

exports.logicalOperators = {
  and: 'and',
  or: 'or',
  not: 'not'
}
