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
 * Formatting of individual endpoint configuration rows.
 *
 * The endpoint configuration is produced in three layers:
 *   1. collection: `helper-endpointconfig.js` turns the session database into
 *      lists of plain objects (attributes, clusters, commands, ...).
 *   2. formatting: this module turns one such object into the C tokens that
 *      end up in the generated file.
 *   3. layout: templates decide where those tokens go, either through the
 *      aggregate helpers in `helper-endpointconfig.js` or through the
 *      iterators in `helper-endpointconfig-iterators.js`.
 *
 * Functions here are pure: no database, no handlebars context. That is what
 * lets the aggregate helpers and the per-row helpers emit identical output.
 *
 * @module Generator: endpoint configuration formatters
 */

const types = require('../util/types.js')
const dbEnum = require('../../src-shared/db-enum.js')

/**
 * Formats an array of mask names into a C expression.
 *
 * @param {*} mask array of mask names
 * @param {*} macro name of the wrapping macro
 * @returns '0' for an empty mask, or the masks combined with '|'
 */
function maskExpression(mask, macro) {
  if (mask == null || mask.length == 0) {
    return '0'
  }
  return mask.map((m) => `${macro}(${m.toUpperCase()})`).join(' | ')
}

/**
 * Formats the mask of a single attribute.
 *
 * @param {*} mask array of mask names
 * @returns attribute mask expression
 */
function attributeMask(mask) {
  return maskExpression(mask, 'ZAP_ATTRIBUTE_MASK')
}

/**
 * Formats the mask of a single cluster. Reporting configuration rows use the
 * cluster mask macro as well.
 *
 * @param {*} mask array of mask names
 * @returns cluster mask expression
 */
function clusterMask(mask) {
  return maskExpression(mask, 'ZAP_CLUSTER_MASK')
}

/**
 * Formats the mask of a single command.
 *
 * @param {*} mask array of mask names
 * @returns command mask expression
 */
function commandMask(mask) {
  return maskExpression(mask, 'ZAP_COMMAND_MASK')
}

/**
 * Reads the endianness and pointer size out of template hash arguments.
 *
 * @param {*} hash handlebars hash arguments, may be undefined
 * @returns object with littleEndian and pointerSize
 */
function endianOptions(hash) {
  let littleEndian = true
  let pointerSize = 4
  if (hash && hash.endian == 'big') {
    littleEndian = false
    if (typeof hash.pointer != 'undefined') {
      pointerSize = hash.pointer
    }
  }
  return { littleEndian: littleEndian, pointerSize: pointerSize }
}

/**
 * Formats the default value of a single attribute.
 *
 * Attributes whose default lives in the long defaults or min/max tables carry
 * a macro reference as their default value, which is emitted verbatim.
 *
 * @param {*} attribute attribute row
 * @param {*} hash handlebars hash arguments (endian, pointer)
 * @returns default value expression
 */
function attributeDefaultValue(attribute, hash) {
  if (!attribute.defaultValue) {
    return `ZAP_EMPTY_DEFAULT()`
  }
  if (attribute.isMacro) {
    return attribute.defaultValue
  }
  let { littleEndian, pointerSize } = endianOptions(hash)
  let defaultValue = attribute.defaultValue
  if (!littleEndian) {
    defaultValue = Number(defaultValue)
      .toString(16)
      .padStart(6, '0x0000')
      .padEnd(2 + 2 * pointerSize, '0')
  }
  return `ZAP_SIMPLE_DEFAULT(${defaultValue})`
}

/**
 * Formats one attribute as the body of a C struct initializer, in the order
 * requested by the template.
 *
 * @param {*} attribute attribute row
 * @param {*} order comma separated list of 'default', 'id', 'size', 'type', 'mask'
 * @param {*} hash handlebars hash arguments (endian, pointer)
 * @returns comma separated initializer items
 */
function attributeItems(attribute, order, hash) {
  let mask = attributeMask(attribute.mask)
  let defaultValue = attributeDefaultValue(attribute, hash)
  let items = []
  order
    .split(',')
    .map((x) => (x ? x.trim() : ''))
    .forEach((token) => {
      switch (token) {
        case 'default':
          items.push(defaultValue)
          break
        case 'id':
          items.push(attribute.id)
          break
        case 'size':
          items.push(attribute.size)
          break
        case 'type':
          items.push(attribute.type)
          break
        case 'mask':
          items.push(mask)
          break
        default:
          throw new Error(`Unknown token '${token}' in order optional argument`)
      }
    })
  return items.join(', ')
}

/**
 * Resolves the default, minimum and maximum of a min/max row into the values
 * that go into the generated min/max table.
 *
 * Attributes that specify neither a minimum nor a maximum get the extremes of
 * their type, which depends on the size and signedness of that type.
 *
 * @param {*} minMax min/max row
 * @param {*} category template package category, used for Zigbee validation
 * @returns object with def, min and max, formatted as hexadecimal strings
 */
function minMaxValues(minMax, category) {
  if (minMax.typeSize > 2 && category === dbEnum.helperCategory.zigbee) {
    throw new Error(
      `Can't have min/max for attributes larger than 2 bytes like '${minMax.name}'`
    )
  }

  let def = parseInt(minMax.default)
  let min = parseInt(minMax.min)
  let max = parseInt(minMax.max)

  if (isNaN(def)) def = 0
  if (isNaN(min)) {
    if (minMax.typeSize < 1)
      throw new Error(
        'Invalid type size for min value: ' + JSON.stringify(minMax)
      )
    if (minMax.isTypeSigned) {
      min = '0x80' + '00'.repeat(minMax.typeSize - 1)
    } else {
      min = 0
    }
  }
  if (isNaN(max)) {
    if (minMax.typeSize < 1)
      throw new Error(
        'Invalid type size for max value: ' + JSON.stringify(minMax)
      )
    if (minMax.isTypeSigned) {
      max = '0x7F' + 'FF'.repeat(minMax.typeSize - 1)
    } else {
      max = '0x' + 'FF'.repeat(minMax.typeSize)
    }
  }

  return {
    def: asCastHex(def),
    min: asCastHex(min),
    max: asCastHex(max)
  }
}

/**
 * Formats a min/max table value as a cast hexadecimal number.
 *
 * @param {*} value number or hexadecimal string
 * @returns value cast to uint16_t
 */
function asCastHex(value) {
  let sign = value >= 0 ? '' : '-'
  return `(uint16_t)${sign}0x${Math.abs(value).toString(16).toUpperCase()}`
}

/**
 * Formats one min/max row as the body of a C struct initializer.
 *
 * @param {*} minMax min/max row
 * @param {*} order comma separated list of 'def', 'min', 'max'
 * @param {*} category template package category
 * @returns comma separated initializer items
 */
function minMaxItems(minMax, order, category) {
  let values = minMaxValues(minMax, category)
  let items = []
  order
    .split(',')
    .map((x) => (x ? x.trim() : ''))
    .forEach((token) => {
      switch (token) {
        case 'def':
          items.push(values.def)
          break
        case 'min':
          items.push(values.min)
          break
        case 'max':
          items.push(values.max)
          break
      }
    })
  return items.join(', ')
}

/**
 * Formats the bytes of one long default value.
 *
 * Values are collected in big-endian order. For types where endianness
 * matters, the bytes are reversed for little-endian targets.
 *
 * @param {*} longDefault long default row
 * @param {*} hash handlebars hash arguments (endian)
 * @returns comma separated list of bytes
 */
function longDefaultValue(longDefault, hash) {
  let { littleEndian } = endianOptions(hash)
  if (!littleEndian || types.isString(longDefault.type)) {
    return longDefault.value
  }
  let bytes = longDefault.value.split(/\s*,\s*/).filter((s) => s.length != 0)
  bytes.reverse()
  return bytes.join(', ') + ', '
}

/**
 * Formats one reporting configuration row as the body of a C struct
 * initializer.
 *
 * @param {*} report reporting row
 * @param {*} order comma separated list of 'direction', 'endpoint', 'clusterId', 'attributeId', 'mask', 'mfgCode', 'minmax'
 * @param {*} minMaxOrder comma separated list of 'min', 'max', 'change'
 * @returns comma separated initializer items
 */
function reportingItems(report, order, minMaxOrder) {
  let minMaxItems = []
  minMaxOrder
    .split(',')
    .map((x) => (x ? x.trim() : ''))
    .forEach((token) => {
      switch (token) {
        case 'min':
          minMaxItems.push(report.minOrSource)
          break
        case 'max':
          minMaxItems.push(report.maxOrEndpoint)
          break
        case 'change':
          minMaxItems.push(report.reportableChangeOrTimeout)
          break
      }
    })

  let mask = clusterMask(report.mask)
  let items = []
  order
    .split(',')
    .map((x) => (x ? x.trim() : ''))
    .forEach((token) => {
      switch (token) {
        case 'direction':
          items.push(`ZAP_REPORT_DIRECTION(${report.direction})`)
          break
        case 'endpoint':
          items.push(report.endpoint)
          break
        case 'clusterId':
          items.push(report.clusterId)
          break
        case 'attributeId':
          items.push(report.attributeId)
          break
        case 'mask':
          items.push(mask)
          break
        case 'mfgCode':
          items.push(report.mfgCode)
          break
        case 'minmax':
          items.push(`{{ ${minMaxItems.join(', ')} }}`)
          break
        default:
          throw new Error(`Unknown token '${token}' in order optional argument`)
      }
    })
  return items.join(', ')
}

/**
 * Parses a template argument that carries a set of cluster names or cluster
 * codes. Both commas and newlines separate entries, so that long lists stay
 * readable inside a template.
 *
 * @param {*} value hash argument value
 * @returns array of trimmed, non empty tokens
 */
function parseClusterTokens(value) {
  if (value == null) return []
  return String(value)
    .split(/[,\n]/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
}

/**
 * Checks whether a cluster is named by one of the given tokens. A token
 * matches either the cluster name, case insensitively, or the cluster code in
 * any numeric notation.
 *
 * @param {*} cluster cluster with name and code
 * @param {*} tokens array of tokens, as returned by parseClusterTokens
 * @returns true if the cluster matches
 */
function clusterMatches(cluster, tokens) {
  if (tokens.length == 0) return false
  // Rows of the endpoint configuration carry the cluster they belong to in
  // clusterName and clusterCode, and their own identity in name and code, so
  // the cluster fields have to win. Otherwise an attribute would be matched by
  // its own name, and by its own code.
  let name = cluster.clusterName != null ? cluster.clusterName : cluster.name
  let code = cluster.clusterCode != null ? cluster.clusterCode : cluster.code
  let lowerCaseName = name == null ? null : name.toLowerCase()
  for (let token of tokens) {
    if (lowerCaseName != null && token.toLowerCase() === lowerCaseName) {
      return true
    }
    let tokenCode = Number(token)
    if (
      code != null &&
      !Number.isNaN(tokenCode) &&
      tokenCode === Number(code)
    ) {
      return true
    }
  }
  return false
}

exports.attributeMask = attributeMask
exports.clusterMask = clusterMask
exports.commandMask = commandMask
exports.attributeDefaultValue = attributeDefaultValue
exports.attributeItems = attributeItems
exports.minMaxValues = minMaxValues
exports.minMaxItems = minMaxItems
exports.longDefaultValue = longDefaultValue
exports.reportingItems = reportingItems
exports.parseClusterTokens = parseClusterTokens
exports.clusterMatches = clusterMatches
exports.endianOptions = endianOptions
