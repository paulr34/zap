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
 * This module provides the API to access zcl specific information.
 *
 * @module REST API: user data
 */

const queryPackage = require('../db/query-package')
const queryZcl = require('../db/query-zcl')
const dbEnum = require('../../src-shared/db-enum')
const util = require('../util/util')
const env = require('../util/env')

/**
 * Promise that return a list of component Ids required by a specific cluster
 * @param {*} db
 * @param {*} sessionId
 * @param {*} clusterId
 * @param {*} side
 * @returns {*} array of componentIds
 */
async function getComponentIdsByCluster(db, sessionId, clusterId, side) {
  // enable components
  let pkgs = await queryPackage.getSessionPackagesByType(
    db,
    sessionId,
    dbEnum.packageType.genTemplatesJson
  )
  if (pkgs.length === 0) {
    return []
  }

  try {
    let cluster = await queryZcl.selectClusterById(db, clusterId)
    if (!cluster) {
      env.logWarning(`Failed to retrieve cluster via clusterId(${clusterId}).`)
      return []
    }

    let componentIds = []
    for (const pkg of pkgs) {
      let extensions = await queryPackage.selectPackageExtension(
        db,
        pkg.id,
        dbEnum.packageExtensionEntity.cluster
      )
      side.forEach((zclRole) => {
        let clusterKey = `${cluster.label.toLowerCase()}-${zclRole}`
        let ids = util.getClusterExtensionDefault(
          extensions,
          'component',
          clusterKey
        )
        if (ids) {
          ids = ids.split(',').map((x) => x.trim())
          componentIds = componentIds.concat(ids)
        }
      })
    }

    return [...new Set(componentIds)]
  } catch (err) {
    env.logWarning(
      `Failed to retrieve component ids required by clusterId(${clusterId}) from cluster extension mapping.`,
      err
    )
    return []
  }
}

exports.getComponentIdsByCluster = getComponentIdsByCluster
