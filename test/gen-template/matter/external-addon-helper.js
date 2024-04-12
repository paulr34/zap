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
 */
// This is an example of an external addon helper for templates.
async function test_external_addon_helper() {
  return 'This is example of test external addon helper.'
}
async function test_external_addon_all_events_helper(api) {
  let events = await api.availableEvents(this)
  let totalEvents = events.length
  return totalEvents
}
async function test_external_addon_all_attributes_helper(api) {
  let attributes = await api.availableAttributes(this)
  let totalAttributes = attributes.length
  return totalAttributes
}
async function test_external_addon_all_commands_helper(api) {
  let commands = await api.availableCommands(this)
  let totalCommands = commands.length
  return totalCommands
}
async function test_external_addon_all_clusters_helper(api) {
  let clusters = await api.availableClusters(this)
  let totalClusters = clusters.length
  return totalClusters
}
async function initialize_helpers(api, context) {
  await api.registerHelpers(
    'test_external_addon_helper',
    test_external_addon_helper,
    context,
    api
  )
  api.registerHelpers(
    'test_external_addon_all_events_helper',
    test_external_addon_all_events_helper,
    context,
    api
  )
  api.registerHelpers(
    'test_external_addon_all_attributes_helper',
    test_external_addon_all_attributes_helper,
    context,
    api
  )
  api.registerHelpers(
    'test_external_addon_all_commands_helper',
    test_external_addon_all_commands_helper,
    context,
    api
  )
  api.registerHelpers(
    'test_external_addon_all_clusters_helper',
    test_external_addon_all_clusters_helper,
    context,
    api
  )
}

exports.initialize_helpers = initialize_helpers
