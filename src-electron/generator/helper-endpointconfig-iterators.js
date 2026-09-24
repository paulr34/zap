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
 */

/**
 * Iterators over the endpoint configuration.
 *
 * The helpers in `helper-endpointconfig.js` return a whole generated table as
 * a single string, which means the layout of that table is decided in
 * javascript. The helpers here iterate the same data one row at a time, so a
 * template can decide the layout, annotate rows, group them, or leave them
 * out. All of them are used inside `{{#endpoint_config}}`, which is what
 * collects the data.
 *
 * Companion formatting helpers turn the current row into the C tokens that the
 * table needs, so a template can reproduce the output of the aggregate helpers
 * exactly, and then change only the part it cares about.
 *
 * See docs/endpoint-config-generation.md for the guide and examples.
 *
 * @module Templating API: Matter endpoint config iterators
 */

const bin = require('../util/bin')
const dbEnum = require('../../src-shared/db-enum.js')
const format = require('./endpointconfig-format.js')
const templateUtil = require('./template-util')

/**
 * Reports the name of the enclosing block when data is missing, which happens
 * when an iterator is used outside of `{{#endpoint_config}}`.
 *
 * @param {*} context handlebars context
 * @param {*} list list that should have been collected
 * @param {*} helperName name of the helper, used in the error message
 * @returns the list
 */
function requireEndpointConfigData(context, list, helperName) {
  if (list == null) {
    throw new Error(
      `Helper {{#${helperName}}} must be used inside {{#endpoint_config}}.`
    )
  }
  return list
}

/**
 * Device types of an endpoint type, leaving out the entries that carry no
 * device identifier. Those contribute nothing to the generated arrays, so
 * counting them would put the offsets of the following endpoints out by one.
 *
 * @param {*} endpointType endpoint type, may be undefined
 * @returns array of device identifiers
 */
function deviceIdentifiersOf(endpointType) {
  if (endpointType == null || endpointType.deviceIdentifiers == null) return []
  return endpointType.deviceIdentifiers.filter((id) => id != null)
}

/**
 * Renames the `index` of a row, which some lists use for an index into a
 * generated table, out of the way.
 *
 * Iteration adds an `index` and a `count` of its own, which is what
 * `{{#first}}`, `{{#last}}` and `{{#not_last}}` read. A row field of the same
 * name would hide those and make the position of a row look like something
 * else, so the row keeps its value under a name that says what it is.
 *
 * @param {*} list list of rows
 * @param {*} name name to give the index of the row
 * @returns copy of the list, with the row index renamed
 */
function withoutIterationClash(list, name) {
  return list.map((row) => {
    let renamed = Object.assign({}, row, { [name]: row.index })
    delete renamed.index
    return renamed
  })
}

/**
 * Marks the rows that start a new comment group.
 *
 * The aggregate helpers print a comment naming the endpoint and the cluster
 * whenever consecutive rows belong to a different cluster. Templates need the
 * same information to reproduce that grouping, so every row reports whether it
 * opens a group.
 *
 * @param {*} list list of rows
 * @returns copy of the list, with isNewComment on every row
 */
function withCommentGroups(list) {
  let previousComment = null
  return list.map((row) => {
    let isNewComment = row.comment != previousComment
    previousComment = row.comment
    return Object.assign({}, row, { isNewComment: isNewComment })
  })
}

/**
 * Iterates over the attributes of the endpoint configuration, in the order in
 * which they appear in the generated attribute table.
 *
 * Row data includes the generated tokens (id, type, size, mask, defaultValue),
 * where the attribute came from (endpointId, clusterId, clusterCode,
 * clusterName, clusterSide), and how it is configured (storage, isWritable,
 * isReadable, isNullable, isSingleton, isReportable).
 *
 * example:
 * {{#endpoint_attributes}}
 *   { {{endpoint_attribute_default}}, {{id}}, {{size}}, {{type}}, {{endpoint_attribute_mask}} },
 * {{/endpoint_attributes}}
 *
 * @param {*} options
 * @returns promise of a rendered block
 */
function endpoint_attributes(options) {
  return templateUtil.collectBlocks(
    withCommentGroups(
      requireEndpointConfigData(this, this.attributeList, 'endpoint_attributes')
    ),
    options,
    this
  )
}

/**
 * Iterates over the clusters of the endpoint configuration.
 *
 * Row data includes the indexes into the attribute, command and event tables,
 * so a template can emit its own cluster table, and omitsAttributeMetadata,
 * omitsCommandMetadata and omitsEventMetadata, which tell whether the metadata
 * of that cluster was left out on purpose.
 *
 * @param {*} options
 * @returns promise of a rendered block
 */
function endpoint_clusters(options) {
  return templateUtil.collectBlocks(
    withCommentGroups(
      requireEndpointConfigData(this, this.clusterList, 'endpoint_clusters')
    ),
    options,
    this
  )
}

/**
 * Iterates over the commands of the endpoint configuration.
 *
 * @param {*} options
 * @returns promise of a rendered block
 */
function endpoint_commands(options) {
  return templateUtil.collectBlocks(
    withCommentGroups(
      requireEndpointConfigData(this, this.commandList, 'endpoint_commands')
    ),
    options,
    this
  )
}

/**
 * Iterates over the events of the endpoint configuration.
 *
 * @param {*} options
 * @returns promise of a rendered block
 */
function endpoint_events(options) {
  return templateUtil.collectBlocks(
    withCommentGroups(
      requireEndpointConfigData(this, this.eventList, 'endpoint_events')
    ),
    options,
    this
  )
}

/**
 * Iterates over the endpoint types, which is what the generated endpoint type
 * table is built from. Every row carries the index of its first cluster, the
 * number of clusters, and the size of the attributes of the endpoint.
 *
 * @param {*} options
 * @returns promise of a rendered block
 */
function endpoint_types(options) {
  return templateUtil.collectBlocks(
    requireEndpointConfigData(this, this.endpointList, 'endpoint_types'),
    options,
    this
  )
}

/**
 * Iterates over the endpoints of the configuration, with everything the
 * generated fixed endpoint arrays need: identifier, profile, network, parent
 * and the index of the endpoint type of the endpoint.
 *
 * Values are provided both as numbers and preformatted as hexadecimal, since
 * the generated arrays use hexadecimal.
 *
 * @param {*} options
 * @returns promise of a rendered block
 */
function endpoint_fixed_endpoints(options) {
  let endpoints = requireEndpointConfigData(
    this,
    this.endpoints,
    'endpoint_fixed_endpoints'
  )
  let endpointTypes = this.endpointTypes || []
  let deviceTypeOffset = 0
  let rows = endpoints.map((ep) => {
    let endpointType = endpointTypes.find((ept) => ept.id == ep.endpointTypeRef)
    // An endpoint type without a device type contributes nothing to the
    // generated device type array, so it must not be counted here either.
    let deviceTypeCount = deviceIdentifiersOf(endpointType).length
    let row = {
      endpointId: ep.endpointId,
      endpointIdHex: '0x' + bin.int16ToHex(ep.endpointId),
      profileId: ep.profileId,
      profileIdHex: '0x' + bin.int16ToHex(parseInt(ep.profileId)),
      networkId: ep.networkId,
      parentEndpointIdentifier: ep.parentEndpointIdentifier,
      parentId:
        ep.parentEndpointIdentifier == null
          ? 'kInvalidEndpointId'
          : ep.parentEndpointIdentifier,
      endpointTypeIndex: endpointTypes.findIndex(
        (ept) => ept.id == ep.endpointTypeRef
      ),
      endpointTypeName: endpointType ? endpointType.name : null,
      deviceTypeCount: deviceTypeCount,
      deviceTypeOffset: deviceTypeOffset
    }
    deviceTypeOffset += deviceTypeCount
    return row
  })
  return templateUtil.collectBlocks(rows, options, this)
}

/**
 * Iterates over all device types of the configuration, one row per device type
 * per endpoint, which is what the generated device type array is built from.
 *
 * @param {*} options
 * @returns promise of a rendered block
 */
function endpoint_device_types(options) {
  let endpointTypes = requireEndpointConfigData(
    this,
    this.endpointTypes,
    'endpoint_device_types'
  )
  let rows = []
  endpointTypes.forEach((ept) => {
    // The version of a device type is found at the same position as its
    // identifier, so the two are paired up before anything is left out.
    let deviceTypes = (ept.deviceIdentifiers || [])
      .map((deviceId, index) => {
        return { deviceId: deviceId, deviceVersion: ept.deviceVersions[index] }
      })
      .filter((deviceType) => deviceType.deviceId != null)
    deviceTypes.forEach((deviceType, indexOnEndpoint) => {
      rows.push({
        endpointId: ept.endpointId,
        deviceId: deviceType.deviceId,
        deviceIdHex: '0x' + bin.int32ToHex(deviceType.deviceId),
        deviceVersion: deviceType.deviceVersion,
        indexOnEndpoint: indexOnEndpoint,
        deviceTypeCountOnEndpoint: deviceTypes.length
      })
    })
  })
  return templateUtil.collectBlocks(rows, options, this)
}

/**
 * Iterates over the attributes that have a minimum and a maximum, which is
 * what the generated min/max table is built from.
 *
 * @param {*} options
 * @returns promise of a rendered block
 */
function endpoint_min_max_defaults(options) {
  return templateUtil.collectBlocks(
    withCommentGroups(
      requireEndpointConfigData(
        this,
        this.minMaxList,
        'endpoint_min_max_defaults'
      )
    ),
    options,
    this
  )
}

/**
 * Iterates over the attributes that have reporting enabled, which is what the
 * generated reporting configuration table is built from.
 *
 * @param {*} options
 * @returns promise of a rendered block
 */
function endpoint_reporting_defaults(options) {
  return templateUtil.collectBlocks(
    withCommentGroups(
      requireEndpointConfigData(
        this,
        this.reportList,
        'endpoint_reporting_defaults'
      )
    ),
    options,
    this
  )
}

/**
 * Iterates over the default values that do not fit inline, which is what the
 * generated defaults blob is built from. Every row carries its `offset` into
 * that blob and the number of bytes it occupies.
 *
 * @param {*} options
 * @returns promise of a rendered block
 */
function endpoint_long_defaults(options) {
  return templateUtil.collectBlocks(
    withCommentGroups(
      withoutIterationClash(
        requireEndpointConfigData(
          this,
          this.longDefaultsList,
          'endpoint_long_defaults'
        ),
        'offset'
      )
    ),
    options,
    this
  )
}

/**
 * Iterates over the manufacturer code pairs of the configuration. The list is
 * selected with the type hash argument, which is one of 'attribute', 'command'
 * or 'cluster' and defaults to 'attribute'. Every row carries its
 * `entryIndex` into the matching generated table and the manufacturer code.
 *
 * example:
 * {{#endpoint_manufacturer_codes type="cluster"}}
 *   { {{entryIndex}}, {{mfgCode}} }, \
 * {{/endpoint_manufacturer_codes}}
 *
 * @param {*} options
 * @returns promise of a rendered block
 */
function endpoint_manufacturer_codes(options) {
  let type = options.hash.type == null ? 'attribute' : options.hash.type
  let lists = {
    attribute: this.attributeMfgCodes,
    command: this.commandMfgCodes,
    cluster: this.clusterMfgCodes
  }
  if (!(type in lists)) {
    throw new Error(
      `Unknown type '${type}' for {{#endpoint_manufacturer_codes}}. Valid values are: ${Object.keys(
        lists
      )
        .map((t) => `"${t}"`)
        .join(', ')}`
    )
  }
  return templateUtil.collectBlocks(
    withoutIterationClash(
      requireEndpointConfigData(
        this,
        lists[type],
        'endpoint_manufacturer_codes'
      ),
      'entryIndex'
    ),
    options,
    this
  )
}

/**
 * Formats the mask of the current attribute, inside
 * `{{#endpoint_attributes}}`.
 *
 * @param {*} options
 * @returns attribute mask expression
 */
function endpoint_attribute_mask(options) {
  return format.attributeMask(this.mask)
}

/**
 * Formats the default value of the current attribute, inside
 * `{{#endpoint_attributes}}`. Takes the same endian and pointer hash
 * arguments as `{{endpoint_attribute_list}}`.
 *
 * @param {*} options
 * @returns default value expression
 */
function endpoint_attribute_default(options) {
  return format.attributeDefaultValue(this, options.hash)
}

/**
 * Formats the current attribute as the body of a C struct initializer, in the
 * order given by the order hash argument, which defaults to the order used by
 * `{{endpoint_attribute_list}}`.
 *
 * @param {*} options
 * @returns comma separated initializer items
 */
function endpoint_attribute_items(options) {
  let order = options.hash.order
  if (order == null || order.length == 0) {
    order = 'id, type, size, mask, default'
  }
  return format.attributeItems(this, order, options.hash)
}

/**
 * Formats the mask of the current cluster, inside `{{#endpoint_clusters}}`.
 *
 * @param {*} options
 * @returns cluster mask expression
 */
function endpoint_cluster_mask(options) {
  return format.clusterMask(this.mask)
}

/**
 * Formats the mask of the current command, inside `{{#endpoint_commands}}`.
 *
 * @param {*} options
 * @returns command mask expression
 */
function endpoint_command_mask(options) {
  return format.commandMask(this.mask)
}

/**
 * Formats the mask of the current reporting row, inside
 * `{{#endpoint_reporting_defaults}}`.
 *
 * @param {*} options
 * @returns cluster mask expression
 */
function endpoint_reporting_mask(options) {
  return format.clusterMask(this.mask)
}

/**
 * Formats the current reporting row as the body of a C struct initializer.
 * Takes the same order and minmaxorder hash arguments as
 * `{{endpoint_reporting_config_defaults}}`.
 *
 * @param {*} options
 * @returns comma separated initializer items
 */
function endpoint_reporting_items(options) {
  let order = options.hash.order
  if (order == null || order.length == 0) {
    order = 'direction,endpoint,clusterId,attributeId,mask,mfgCode,minmax'
  }
  let minMaxOrder = options.hash.minmaxorder
  if (minMaxOrder == null || minMaxOrder.length == 0) {
    minMaxOrder = 'min,max,change'
  }
  return format.reportingItems(this, order, minMaxOrder)
}

/**
 * Returns the template package category, which min/max formatting needs in
 * order to apply the Zigbee restriction on value sizes.
 *
 * @param {*} options
 * @returns category or undefined
 */
function templateCategory(options) {
  return options.data?.root?.global?.genTemplatePackage?.category
}

/**
 * Formats the current min/max row as the body of a C struct initializer, in
 * the order given by the order hash argument, which defaults to the order used
 * by `{{endpoint_attribute_min_max_list}}`.
 *
 * @param {*} options
 * @returns comma separated initializer items
 */
function endpoint_min_max_items(options) {
  let order = options.hash.order
  if (order == null || order.length == 0) {
    order = 'def,min,max'
  }
  return format.minMaxItems(this, order, templateCategory(options))
}

/**
 * Formats the default value of the current min/max row.
 *
 * @param {*} options
 * @returns default value, cast to uint16_t
 */
function endpoint_min_max_default(options) {
  return format.minMaxValues(this, templateCategory(options)).def
}

/**
 * Formats the minimum of the current min/max row.
 *
 * @param {*} options
 * @returns minimum, cast to uint16_t
 */
function endpoint_min_max_min(options) {
  return format.minMaxValues(this, templateCategory(options)).min
}

/**
 * Formats the maximum of the current min/max row.
 *
 * @param {*} options
 * @returns maximum, cast to uint16_t
 */
function endpoint_min_max_max(options) {
  return format.minMaxValues(this, templateCategory(options)).max
}

/**
 * Formats the bytes of the current long default value, inside
 * `{{#endpoint_long_defaults}}`. Takes the same endian hash argument as
 * `{{endpoint_attribute_long_defaults}}`.
 *
 * @param {*} options
 * @returns comma separated list of bytes
 */
function endpoint_long_default_value(options) {
  return format.longDefaultValue(this, options.hash)
}

/**
 * Block helper that runs its body when the current row belongs to a cluster
 * named by the argument. Names are matched case insensitively, codes in any
 * numeric notation, and several of them can be given separated by commas or
 * newlines.
 *
 * example:
 * {{#endpoint_attributes}}
 * {{#if_endpoint_cluster_in "Identify,0x0006"}}...{{else}}...{{/if_endpoint_cluster_in}}
 * {{/endpoint_attributes}}
 *
 * @param {*} clusters cluster names or codes
 * @param {*} options
 * @returns promise of a rendered block
 */
function if_endpoint_cluster_in(clusters, options) {
  let matches = format.clusterMatches(this, format.parseClusterTokens(clusters))
  return matches ? options.fn(this) : options.inverse(this)
}

/**
 * Block helper that runs its body when the current row belongs to a server
 * side cluster.
 *
 * @param {*} options
 * @returns promise of a rendered block
 */
function if_endpoint_cluster_server(options) {
  return this.clusterSide == dbEnum.side.server
    ? options.fn(this)
    : options.inverse(this)
}

// WARNING! WARNING! WARNING! WARNING! WARNING! WARNING!
//
// Note: these exports are public API. Templates that might have been created
// in the past and are available in the wild might depend on these names.
// If you rename the functions, you need to still maintain old exports list.

exports.endpoint_attributes = endpoint_attributes
exports.endpoint_clusters = endpoint_clusters
exports.endpoint_commands = endpoint_commands
exports.endpoint_events = endpoint_events
exports.endpoint_types = endpoint_types
exports.endpoint_fixed_endpoints = endpoint_fixed_endpoints
exports.endpoint_device_types = endpoint_device_types
exports.endpoint_min_max_defaults = endpoint_min_max_defaults
exports.endpoint_reporting_defaults = endpoint_reporting_defaults
exports.endpoint_long_defaults = endpoint_long_defaults
exports.endpoint_manufacturer_codes = endpoint_manufacturer_codes

exports.endpoint_attribute_mask = endpoint_attribute_mask
exports.endpoint_attribute_default = endpoint_attribute_default
exports.endpoint_attribute_items = endpoint_attribute_items
exports.endpoint_cluster_mask = endpoint_cluster_mask
exports.endpoint_command_mask = endpoint_command_mask
exports.endpoint_reporting_mask = endpoint_reporting_mask
exports.endpoint_reporting_items = endpoint_reporting_items
exports.endpoint_min_max_items = endpoint_min_max_items
exports.endpoint_min_max_default = endpoint_min_max_default
exports.endpoint_min_max_min = endpoint_min_max_min
exports.endpoint_min_max_max = endpoint_min_max_max
exports.endpoint_long_default_value = endpoint_long_default_value

exports.if_endpoint_cluster_in = if_endpoint_cluster_in
exports.if_endpoint_cluster_server = if_endpoint_cluster_server
