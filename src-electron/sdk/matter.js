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
 * This module contains Matter specific APIs.
 *
 * @module JS API: Matter specific APIs.
 */

const dbApi = require('../db/db-api.js')
const queryPackage = require('../db/query-package.js')
const queryCluster = require('../db/query-cluster.js')
const dbEnum = require('../../src-shared/db-enum.js')

/**
 * Fetches forced external storage settings based on the given package ID.
 * Utilizes the attribute access interface to query storage policies
 * associated with the specified package ID.
 *
 * Both attribute access interface storage policies are returned. The
 * optionCode of each returned entry says which one it is, so a caller that
 * cares about the default value can tell them apart with
 * dbEnum.storagePolicy.keepsDefaultValue().
 *
 * @param {Object} db - Database connection object.
 * @param {Number} packageIds - The ID of the packages to query.
 * @returns {Promise<Array>} A promise that resolves to an array of forced external storage settings.
 */
async function getForcedExternalStorage(db, packageIds) {
  try {
    // Ensure packageIds is an array
    const packageIdsArray = Array.isArray(packageIds)
      ? packageIds
      : [packageIds]

    let forcedExternal = await queryPackage.getAttributeAccessInterface(
      db,
      [
        dbEnum.storagePolicy.attributeAccessInterface,
        dbEnum.storagePolicy.attributeAccessInterfaceWithDefault
      ],
      packageIdsArray
    )
    return forcedExternal
  } catch (error) {
    console.error('Error fetching forced external storage:', error)
    throw error // Optionally re-throw the error for further handling
  }
}

/**
 * Returns the storage policy that the given cluster/attribute pair is forced
 * to, or null when it is not forced to external storage at all.
 *
 * A pair can be matched by more than one policy, because the policy of an
 * attribute can come both from the attribute itself and from the metadata file
 * naming the cluster/attribute pair. Asking to keep the default value is always
 * specific to the pair, so it wins.
 *
 * @param {Array} forcedExternal - An array of external options.
 * @param {String} clusterName - The name of the cluster.
 * @param {String} attributeName - The name of the attribute.
 * @returns {String|null} the storage policy, or null
 */
function forcedExternalStoragePolicy(
  forcedExternal,
  clusterName,
  attributeName
) {
  let matches = forcedExternal.filter(
    (option) =>
      option.optionCategory == clusterName &&
      option.optionLabel == attributeName
  )
  if (matches.length == 0) return null
  let keepsDefault = matches.find((option) =>
    dbEnum.storagePolicy.keepsDefaultValue(option.optionCode)
  )
  return keepsDefault ? keepsDefault.optionCode : matches[0].optionCode
}

/**
 * This function takes a clusterId (the database ID, not the specification-defined ID), an array of attributes (associated with the database defined clusterID),
 * and a packageId to identify the specific package the attributes belong to. It changes the global attributes (attributes with specification defined clusterId = null) to represent storage policy
 * based on the cluster/attribute pair in zcl.json.
 *
 * Although the specification defined clusterID of the attribute is null indicating it is a global attribute, we know what the database defined clusterID is by what is passed in as a parameter.
 *
 * That database defined clusterID is used to query the name of the cluster which is in turn used to compute the storage policy for that cluster/attribute pair based on the packageId.
 *
 * @export
 * @param {*} db
 * @param {*} clusterId (database defined) the clusterId representing a cluster from the database being used in the application
 * @param {*} attributes an array of objects representing the attributes associated with the cluster
 * @param {*} packageId the ID of the package to which the attributes belong, used to determine storage policies specific to the package
 * @returns an array of objects representing attributes in the database
 */
async function computeStoragePolicyForGlobalAttributes(
  db,
  clusterId,
  attributes,
  packageIds
) {
  try {
    let forcedExternal
    let clusterName = await queryCluster.selectClusterName(db, clusterId)
    return Promise.all(
      attributes.map(async (attribute) => {
        if (attribute.clusterId == null) {
          forcedExternal = await getForcedExternalStorage(db, packageIds)
          let policy = forcedExternalStoragePolicy(
            forcedExternal,
            clusterName,
            attribute.name
          )
          if (policy != null) {
            attribute.storagePolicy = policy
          }
        }
        return attribute
      })
    )
  } catch (error) {
    console.error(
      'Failed to compute storage policy for global attributes:',
      error
    )
    throw error // Rethrow the error if you want to handle it further up the call stack
  }
}

/**
 * This asynchronous function computes and returns the new configuration for a storage option.
 *
 * @param {String} storagePolicy - The current storage policy.
 *
 * The function first initializes the storageOption. Then it checks the storagePolicy:
 * - If it forces the attribute access interface, it sets the storageOption to 'external'.
 * - If it's 'any', it sets the storageOption to 'ram'.
 * If the storagePolicy is neither of these, it throws an error 'check storage policy'.
 * Finally, it returns the updated storage option.
 */
async function computeStorageOptionNewConfig(storagePolicy) {
  try {
    let storageOption
    if (dbEnum.storagePolicy.forcesExternalStorage(storagePolicy)) {
      storageOption = dbEnum.storageOption.external
    } else if (storagePolicy == dbEnum.storagePolicy.any) {
      storageOption = dbEnum.storageOption.ram
    } else {
      throw new Error('Invalid storage policy')
    }
    return storageOption
  } catch (error) {
    console.error('Error computing new storage option config:', error)
    throw error // Rethrow the error for further handling if necessary
  }
}
/**
 * This asynchronous function computes and returns the new configuration for a storage policy.
 *
 * @param {Object} db - The database instance.
 * @param {Number} clusterRef - The reference to the cluster.
 * @param {String} storagePolicy - The current storage policy.
 * @param {Array} forcedExternal - An array of external options.
 * @param {String} attributeName - The name of the attribute.
 *
 * The function first queries to get the cluster name using the cluster reference.
 * Then it looks for the cluster/attribute pair in the forcedExternal array. If it
 * is there, it updates the storage policy to the one that pair is forced to.
 * Finally, it returns the updated storage policy.
 */
async function computeStoragePolicyNewConfig(
  db,
  clusterRef,
  storagePolicy,
  forcedExternal,
  attributeName
) {
  try {
    let clusterName = await queryCluster.selectClusterName(db, clusterRef)
    let policy = forcedExternalStoragePolicy(
      forcedExternal,
      clusterName,
      attributeName
    )
    return policy != null ? policy : storagePolicy
  } catch (error) {
    console.error('Error computing storage policy new config:', error)
    throw error // Rethrow the error for further handling if necessary
  }
}

/**
 * This asynchronous function computes and returns the updated storage import policy.
 *
 * @param {Object} db - The database instance.
 * @param {String} clusterName - The name of the cluster.
 * @param {String} storagePolicy - The current storage policy.
 * @param {Array} forcedExternal - An array of external options.
 * @param {String} attributeName - The name of the attribute.
 *
 * The function looks for the cluster/attribute pair in the forcedExternal array.
 * If it is there, the storage policy that pair is forced to is returned.
 * Otherwise the current storage policy is returned unchanged.
 */
async function computeStorageImport(
  db,
  clusterName,
  storagePolicy,
  forcedExternal,
  attributeName
) {
  try {
    let policy = forcedExternalStoragePolicy(
      forcedExternal,
      clusterName,
      attributeName
    )
    return policy != null ? policy : storagePolicy
  } catch (error) {
    console.error('Error computing storage import:', error)
    throw error // Rethrow the error for further handling if necessary
  }
}

exports.getForcedExternalStorage = getForcedExternalStorage
exports.forcedExternalStoragePolicy = forcedExternalStoragePolicy
exports.computeStorageImport = computeStorageImport
exports.computeStoragePolicyNewConfig = computeStoragePolicyNewConfig
exports.computeStorageOptionNewConfig = computeStorageOptionNewConfig
exports.computeStoragePolicyForGlobalAttributes =
  computeStoragePolicyForGlobalAttributes
