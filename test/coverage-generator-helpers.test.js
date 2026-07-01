/**
 *
 *    Copyright (c) 2024 Silicon Labs
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

const { timeout } = require('./test-util')
const darwin = require('../src-electron/generator/matter/darwin/Framework/CHIP/templates/helper.js')
const appHelper = require('../src-electron/generator/matter/app/zap-templates/templates/app/helper.js')
const chipTool = require('../src-electron/generator/matter/chip-tool/templates/helper.js')

describe('Darwin Objective-C template helpers', () => {
  const opts = { hash: { preserveAcronyms: false } }

  test(
    'asStructPropertyName normalizes names and reserved words',
    () => {
      expect(darwin.asStructPropertyName('Description')).toBe(
        'descriptionString'
      )
      expect(darwin.asStructPropertyName('FooBar')).toBe('fooBar')
      // all-uppercase acronym collapses to lowercase
      expect(darwin.asStructPropertyName('ACL')).toBe('acl')
    },
    timeout.short()
  )

  test(
    'asMethodName lower-camel-cases',
    () => {
      expect(darwin.asMethodName('SomeName')).toBe('someName')
    },
    timeout.short()
  )

  test(
    'asGetterName prefixes get for reserved-ish names',
    () => {
      expect(darwin.asGetterName('NewThing')).toBe('getNewThing')
      expect(darwin.asGetterName('Count')).toBe('getCount')
      expect(darwin.asGetterName('SomeName')).toBe('someName')
    },
    timeout.short()
  )

  test(
    'commandHasRequiredField detects non-optional args',
    () => {
      expect(
        darwin.commandHasRequiredField({
          arguments: [{ isOptional: false }, { isOptional: true }]
        })
      ).toBe(true)
      expect(
        darwin.commandHasRequiredField({
          arguments: [{ isOptional: true }]
        })
      ).toBe(false)
    },
    timeout.short()
  )

  test(
    'objCEnumName strips redundant cluster names and Enum suffix',
    () => {
      expect(darwin.objCEnumName('Globals', 'Foo', opts)).toBe('MTRDataTypeFoo')
      expect(darwin.objCEnumName('OnOff', 'OnOffFeatureEnum', opts)).toBe(
        'MTROnOffFeature'
      )
    },
    timeout.short()
  )

  test(
    'objCEnumItemLabel handles all-caps single words and normal labels',
    () => {
      expect(darwin.objCEnumItemLabel('WEP-PERSONAL', opts)).toBe('WepPersonal')
      // single all-caps word passes through (minus punctuation)
      expect(darwin.objCEnumItemLabel('ABC', opts)).toBe('ABC')
    },
    timeout.short()
  )

  test(
    'hasArguments reflects argument list length',
    () => {
      expect(darwin.hasArguments.call({ arguments: [1, 2] })).toBe(true)
      expect(darwin.hasArguments.call({ arguments: [] })).toBe(false)
    },
    timeout.short()
  )

  test(
    'asObjectiveCBasicType maps string types to Foundation types',
    () => {
      expect(
        darwin.asObjectiveCBasicType.call({}, 'char_string', {
          hash: { is_mutable: false }
        })
      ).toBe('NSString *')
      expect(
        darwin.asObjectiveCBasicType.call({}, 'char_string', {
          hash: { is_mutable: true }
        })
      ).toBe('NSMutableString *')
      expect(
        darwin.asObjectiveCBasicType.call({}, 'octet_string', {
          hash: { is_mutable: false }
        })
      ).toBe('NSData *')
      expect(
        darwin.asObjectiveCBasicType.call({}, 'octet_string', {
          hash: { is_mutable: true }
        })
      ).toBe('NSMutableData *')
    },
    timeout.short()
  )
})

describe('App zap-template helpers', () => {
  test(
    'asUpperCamelCase / asLowerCamelCase',
    () => {
      expect(appHelper.asUpperCamelCase('some label')).toBe('SomeLabel')
      expect(appHelper.asLowerCamelCase('Some Label')).toBe('someLabel')
    },
    timeout.short()
  )

  test(
    'asMEI composes a manufacturer-extended identifier',
    () => {
      expect(appHelper.asMEI(0x0001, 0x0002)).toBe('0x00010002')
    },
    timeout.short()
  )

  test(
    'incrementDepth increments the numeric depth',
    () => {
      expect(appHelper.incrementDepth(3)).toBe(4)
      expect(appHelper.incrementDepth(0)).toBe(1)
    },
    timeout.short()
  )
})

describe('chip-tool template helpers', () => {
  test(
    'asDelimitedCommand converts to kebab-case',
    () => {
      expect(chipTool.asDelimitedCommand('SomeCommandName')).toBe(
        'some-command-name'
      )
    },
    timeout.short()
  )
})
