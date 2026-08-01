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
 *
 * @jest-environment node
 */

const format = require('../src-electron/generator/endpointconfig-format')
const dbEnum = require('../src-shared/db-enum')
const testUtil = require('./test-util')

test(
  'Endpoint config masks',
  () => {
    expect(format.attributeMask([])).toEqual('0')
    expect(format.attributeMask(['writable', 'nullable'])).toEqual(
      'ZAP_ATTRIBUTE_MASK(WRITABLE) | ZAP_ATTRIBUTE_MASK(NULLABLE)'
    )
    expect(format.clusterMask(['server'])).toEqual('ZAP_CLUSTER_MASK(SERVER)')
    expect(format.commandMask(['incoming_server'])).toEqual(
      'ZAP_COMMAND_MASK(INCOMING_SERVER)'
    )
  },
  testUtil.timeout.short()
)

test(
  'Endpoint config attribute default values',
  () => {
    // No default value at all.
    expect(format.attributeDefaultValue({ defaultValue: null }, {})).toEqual(
      'ZAP_EMPTY_DEFAULT()'
    )
    // Values that live in another table are referenced by macro.
    expect(
      format.attributeDefaultValue(
        { defaultValue: 'ZAP_LONG_DEFAULTS_INDEX(4)', isMacro: true },
        {}
      )
    ).toEqual('ZAP_LONG_DEFAULTS_INDEX(4)')
    // Inline values are emitted as they are for little-endian targets, and
    // padded to the pointer size for big-endian ones.
    expect(
      format.attributeDefaultValue({ defaultValue: '0x1234' }, {})
    ).toEqual('ZAP_SIMPLE_DEFAULT(0x1234)')
    expect(
      format.attributeDefaultValue(
        { defaultValue: '0x1234' },
        { endian: 'big', pointer: 4 }
      )
    ).toEqual('ZAP_SIMPLE_DEFAULT(0x12340000)')
    expect(
      format.attributeDefaultValue(
        { defaultValue: '0x1234' },
        { endian: 'big', pointer: 8 }
      )
    ).toEqual('ZAP_SIMPLE_DEFAULT(0x1234000000000000)')
  },
  testUtil.timeout.short()
)

test(
  'Endpoint config attribute row items follow the requested order',
  () => {
    let attribute = {
      id: '0x00000000',
      type: 'ZAP_TYPE(INT16U)',
      size: 2,
      mask: ['writable'],
      defaultValue: '0x01'
    }
    expect(
      format.attributeItems(attribute, 'id, type, size, mask, default', {})
    ).toEqual(
      '0x00000000, ZAP_TYPE(INT16U), 2, ZAP_ATTRIBUTE_MASK(WRITABLE), ZAP_SIMPLE_DEFAULT(0x01)'
    )
    expect(
      format.attributeItems(attribute, 'default,id,size,type,mask', {})
    ).toEqual(
      'ZAP_SIMPLE_DEFAULT(0x01), 0x00000000, 2, ZAP_TYPE(INT16U), ZAP_ATTRIBUTE_MASK(WRITABLE)'
    )
    expect(() => format.attributeItems(attribute, 'nonsense', {})).toThrow(
      "Unknown token 'nonsense'"
    )
  },
  testUtil.timeout.short()
)

test(
  'Endpoint config min max values fall back to the extremes of the type',
  () => {
    expect(
      format.minMaxValues({ default: 5, min: 1, max: 10, typeSize: 1 })
    ).toEqual({
      def: '(uint16_t)0x5',
      min: '(uint16_t)0x1',
      max: '(uint16_t)0xA'
    })
    // Unsigned attributes without a range use the whole range of the type.
    expect(
      format.minMaxValues({
        default: 0,
        min: NaN,
        max: NaN,
        typeSize: 2,
        isTypeSigned: false
      })
    ).toEqual({
      def: '(uint16_t)0x0',
      min: '(uint16_t)0x0',
      max: '(uint16_t)0xFFFF'
    })
    // Signed ones use the signed range.
    expect(
      format.minMaxValues({
        default: 0,
        min: NaN,
        max: NaN,
        typeSize: 2,
        isTypeSigned: true
      })
    ).toEqual({
      def: '(uint16_t)0x0',
      min: '(uint16_t)0x8000',
      max: '(uint16_t)0x7FFF'
    })
    // Zigbee stores a single 16 bit value, so anything wider is an error.
    expect(() =>
      format.minMaxValues(
        { default: 0, min: 0, max: 1, typeSize: 4, name: 'Wide' },
        dbEnum.helperCategory.zigbee
      )
    ).toThrow("Can't have min/max for attributes larger than 2 bytes")
  },
  testUtil.timeout.short()
)

test(
  'Endpoint config long default values are reversed for little-endian targets',
  () => {
    let longDefault = { value: '0x12, 0x34, ', type: 'int16u' }
    expect(format.longDefaultValue(longDefault, { endian: 'big' })).toEqual(
      '0x12, 0x34, '
    )
    expect(format.longDefaultValue(longDefault, { endian: 'little' })).toEqual(
      '0x34, 0x12, '
    )
    // Strings are already in the order in which they are stored.
    let string = { value: "3, 'a', 'b', 'c', ", type: 'char_string' }
    expect(format.longDefaultValue(string, { endian: 'little' })).toEqual(
      "3, 'a', 'b', 'c', "
    )
  },
  testUtil.timeout.short()
)

test(
  'Endpoint config cluster matching accepts names, codes and separators',
  () => {
    let tokens = format.parseClusterTokens(
      'Level Control, 0x0006 \n Identify,,  '
    )
    expect(tokens).toEqual(['Level Control', '0x0006', 'Identify'])

    // Names match case insensitively, codes in any notation.
    expect(
      format.clusterMatches({ name: 'level control', code: 8 }, tokens)
    ).toBeTruthy()

    // Rows of the endpoint configuration are matched by the cluster they
    // belong to, not by their own name or code.
    let identifyTime = {
      name: 'IdentifyTime',
      code: 0,
      clusterName: 'Identify',
      clusterCode: 3
    }
    expect(format.clusterMatches(identifyTime, tokens)).toBeTruthy()
    let onOffAttribute = {
      name: 'OnOff',
      code: 0,
      clusterName: 'On/Off',
      clusterCode: 6
    }
    expect(format.clusterMatches(onOffAttribute, tokens)).toBeTruthy()
    // An attribute of another cluster whose own code is 0x0006 is not a match.
    expect(
      format.clusterMatches(
        {
          name: 'Whatever',
          code: 6,
          clusterName: 'Basic Information',
          clusterCode: 40
        },
        tokens
      )
    ).toBeFalsy()
    expect(
      format.clusterMatches({ name: 'On/Off', code: 6 }, tokens)
    ).toBeTruthy()
    expect(
      format.clusterMatches({ clusterName: 'Identify', clusterCode: 3 }, tokens)
    ).toBeTruthy()
    expect(
      format.clusterMatches({ name: 'Descriptor', code: 0x1d }, tokens)
    ).toBeFalsy()
    // An empty list never matches, so leaving the option out changes nothing.
    expect(format.clusterMatches({ name: 'Identify', code: 3 }, [])).toBeFalsy()
  },
  testUtil.timeout.short()
)
