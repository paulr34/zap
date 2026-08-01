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
 * Cluster implementation metadata.
 *
 * Enabling a cluster in ZAP is not the whole story for a cluster that is
 * implemented in code. Such a cluster holds its own attribute state, so the
 * attribute store that ZAP generates has nothing to do for it, and some of the
 * choices that ZAP offers for those attributes have no meaning.
 *
 * An SDK describes that with a `clusterImplementation` section, which this
 * module reads, validates against the loaded ZCL, and turns into two things:
 * an implementation on the cluster, and a storage policy on its attributes.
 *
 * See docs/code-driven-clusters.md.
 *
 * @module Loader API: Cluster implementation metadata
 */

const fsp = require('fs').promises
const path = require('path')
const dbEnum = require('../../src-shared/db-enum.js')
const queryCluster = require('../db/query-cluster.js')
const queryPackage = require('../db/query-package.js')
const queryZcl = require('../db/query-zcl.js')

/**
 * Reads the `clusterImplementation` value of a ZCL metadata file.
 *
 * The value is either the metadata itself, or the name of a JSON file that
 * holds it, relative to the metadata file. A separate file is the better
 * option for an SDK that generates this data from the source of truth in its
 * own tree.
 *
 * @param {*} metadataFile path of the zcl.json file
 * @param {*} value value of the clusterImplementation key
 * @returns the metadata, or null when there is none
 */
async function resolveClusterImplementation(metadataFile, value) {
  if (value == null) return null
  if (typeof value !== 'string') return value
  let file = path.join(path.dirname(metadataFile), value)
  let content = await fsp.readFile(file, 'utf8')
  try {
    return JSON.parse(content)
  } catch (err) {
    throw new Error(
      `Invalid JSON in cluster implementation file "${file}": ${err.message}`
    )
  }
}

/**
 * Resolves the handling of one attribute of a cluster. An entry for the
 * attribute wins over the '*' entry, which is the fallback for the whole
 * cluster. Clusters without any entry fall back to what the implementation
 * implies: a code driven cluster owns everything unless it says otherwise.
 *
 * @param {*} clusterEntry entry of one cluster
 * @param {*} attributeName name of the attribute
 * @returns one of dbEnum.attributeHandling
 */
function attributeHandlingOf(clusterEntry, attributeName) {
  let attributes = clusterEntry.attributes || {}
  let handling = attributes[attributeName]
  if (handling == null) handling = attributes['*']
  if (handling == null) {
    handling =
      dbEnum.clusterImplementation.resolve(clusterEntry.implementation) ==
      dbEnum.clusterImplementation.codeDriven
        ? dbEnum.attributeHandling.internal
        : dbEnum.attributeHandling.any
  }
  let resolved = dbEnum.attributeHandling.resolve(handling)
  if (resolved == null) {
    throw new Error(
      `Unknown attribute handling "${handling}" in clusterImplementation. Valid values are: ${[
        dbEnum.attributeHandling.any,
        dbEnum.attributeHandling.defaultOnly,
        dbEnum.attributeHandling.internal
      ]
        .map((h) => `"${h}"`)
        .join(', ')}`
    )
  }
  return resolved
}

/**
 * Checks the metadata against the ZCL that was loaded, so that a typo in a
 * cluster or attribute name is reported instead of silently doing nothing.
 *
 * @param {*} db
 * @param {*} packageId
 * @param {*} clusterImplementation the metadata
 * @returns array with the cluster, its entry and its attributes, per named cluster
 */
async function validateClusterImplementation(
  db,
  packageId,
  clusterImplementation
) {
  let clusters = clusterImplementation.clusters
  if (clusters == null) {
    throw new Error(
      '\n\nMissing "clusters" key in clusterImplementation metadata\n\n'
    )
  }
  let knownClusters = await queryZcl.selectAllClusters(db, packageId)
  let resolved = []
  for (let clusterName of Object.keys(clusters)) {
    let cluster = knownClusters.find((c) => c.name == clusterName)
    if (!cluster) {
      throw new Error(
        `\n\nUnknown cluster "${clusterName}" in clusterImplementation\n\n`
      )
    }
    let entry = clusters[clusterName]
    let knownAttributes =
      await queryZcl.selectAttributesByClusterIdIncludingGlobal(
        db,
        cluster.id,
        packageId
      )
    for (let attributeName of Object.keys(entry.attributes || {})) {
      if (
        attributeName != '*' &&
        !knownAttributes.find((a) => a.name == attributeName)
      ) {
        throw new Error(
          `\n\nUnknown attribute "${attributeName}" in clusterImplementation["${clusterName}"]\n\n`
        )
      }
    }
    resolved.push({
      cluster: cluster,
      entry: entry,
      attributes: knownAttributes
    })
  }
  return resolved
}

/**
 * Loads cluster implementation metadata into the database.
 *
 * The implementation is recorded on the cluster, and the handling of every
 * attribute is recorded as a storage policy. Global attributes have no cluster
 * of their own in the database, so their policy is recorded per cluster in the
 * package options, the same way the attribute access interface does it.
 *
 * @param {*} db
 * @param {*} packageId
 * @param {*} clusterImplementation the metadata
 * @returns promise that resolves when the metadata is loaded
 */
async function loadClusterImplementation(db, packageId, clusterImplementation) {
  let resolved = await validateClusterImplementation(
    db,
    packageId,
    clusterImplementation
  )
  for (let { cluster, entry, attributes } of resolved) {
    await queryCluster.updateClusterImplementation(
      db,
      cluster.id,
      dbEnum.clusterImplementation.resolve(entry.implementation)
    )

    let globalPolicies = []
    for (let attribute of attributes) {
      let policy = dbEnum.attributeHandling.toStoragePolicy(
        attributeHandlingOf(entry, attribute.name)
      )
      if (policy == dbEnum.storagePolicy.any) continue
      if (attribute.clusterRef == null) {
        // A global attribute is shared by every cluster, so the policy cannot
        // live on the attribute itself.
        globalPolicies.push({ code: policy, label: attribute.name })
      } else {
        await queryCluster.updateAttributeStoragePolicy(
          db,
          attribute.id,
          policy
        )
      }
    }
    if (globalPolicies.length > 0) {
      await queryPackage.insertOptionsKeyValues(
        db,
        packageId,
        cluster.name,
        globalPolicies
      )
    }
  }
}

exports.resolveClusterImplementation = resolveClusterImplementation
exports.loadClusterImplementation = loadClusterImplementation
exports.attributeHandlingOf = attributeHandlingOf
