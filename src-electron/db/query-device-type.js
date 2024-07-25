/**
 *
 *    Copyright (c) 2022 Silicon Labs
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
 * This module provides queries for device types.
 *
 * @module DB API: device type database access
 */
const dbApi = require('./db-api')
const dbMapping = require('./db-mapping')

/**
 * Retrieves all the device types in the database.
 *
 * @param {*} db
 * @param {*} packageId
 * @returns Promise that resolves with the rows of device types.
 */
async function selectAllDeviceTypes(db, packageId) {
  return dbApi
    .dbAll(
      db,
      'SELECT DEVICE_TYPE_ID, DOMAIN, CODE, PROFILE_ID, NAME, DESCRIPTION, CLASS, PACKAGE_REF FROM DEVICE_TYPE WHERE PACKAGE_REF = ? ORDER BY DOMAIN, CODE',
      [packageId]
    )
    .then((rows) => rows.map(dbMapping.map.deviceType))
}

/**
 * Retrieves the device type by its id.
 *
 * @param {*} db
 * @param {*} id
 * @returns Device type
 */
async function selectDeviceTypeById(db, id) {
  return dbApi
    .dbGet(
      db,
      'SELECT DEVICE_TYPE_ID, DOMAIN, CODE, PROFILE_ID, NAME, DESCRIPTION, CLASS, PACKAGE_REF, COMPOSITION FROM DEVICE_TYPE WHERE DEVICE_TYPE_ID = ?',
      [id]
    )
    .then(dbMapping.map.deviceType)
}

/**
 * Retrieves the device type by the package, code and name.
 *
 * @param {*} db
 * @param {*} packageId
 * @param {*} code
 * @param {*} name
 * @returns Device type
 */
async function selectDeviceTypeByCodeAndName(db, packageId, code, name) {
  return dbApi
    .dbGet(
      db,
      'SELECT DEVICE_TYPE_ID, DOMAIN, CODE, PROFILE_ID, NAME, DESCRIPTION, CLASS FROM DEVICE_TYPE WHERE CODE = ? AND NAME = ? AND PACKAGE_REF = ? ',
      [code, name, packageId]
    )
    .then(dbMapping.map.deviceType)
}

/**
 * Retrieves the device type by the package, code and name.
 *
 * @param {*} db
 * @param {*} packageId
 * @param {*} code
 * @param {*} name
 * @returns Device type
 */
async function selectDeviceTypeByCode(db, packageId, code) {
  return dbApi
    .dbGet(
      db,
      'SELECT DEVICE_TYPE_ID, DOMAIN, CODE, PROFILE_ID, NAME, DESCRIPTION, CLASS FROM DEVICE_TYPE WHERE CODE = ? AND PACKAGE_REF = ? ',
      [code, packageId]
    )
    .then(dbMapping.map.deviceType)
}

async function selectDeviceTypeClustersByDeviceTypeRef(db, deviceTypeRef) {
  let rows = await dbApi.dbAll(
    db,
    `
  SELECT
    DEVICE_TYPE_CLUSTER_ID,
    DEVICE_TYPE_REF,
    CLUSTER_REF,
    CLUSTER_NAME,
    INCLUDE_CLIENT,
    INCLUDE_SERVER,
    LOCK_CLIENT,
    LOCK_SERVER
  FROM
    DEVICE_TYPE_CLUSTER
  WHERE
    DEVICE_TYPE_REF IN (?)
  ORDER BY CLUSTER_NAME`,
    [deviceTypeRef]
  )
  return rows.map(dbMapping.map.deviceTypeCluster)
}

async function selectDeviceTypeClusterByDeviceTypeClusterId(
  db,
  deviceTypeClusterId
) {
  let row = await dbApi.dbGet(
    db,
    `
  SELECT
    DEVICE_TYPE_CLUSTER_ID,
    DEVICE_TYPE_REF,
    CLUSTER_REF,
    CLUSTER_NAME,
    INCLUDE_CLIENT,
    INCLUDE_SERVER,
    LOCK_CLIENT,
    LOCK_SERVER
  FROM
    DEVICE_TYPE_CLUSTER
  WHERE
    DEVICE_TYPE_CLUSTER_ID = ?`,
    [deviceTypeClusterId]
  )
  return dbMapping.map.deviceTypeCluster(row)
}

async function selectDeviceTypeAttributesByDeviceTypeRef(db, deviceTypeRef) {
  let rows = await dbApi.dbAll(
    db,
    `
  SELECT
    C.CLUSTER_REF,
    AT.DEVICE_TYPE_CLUSTER_REF,
    AT.ATTRIBUTE_REF,
    ATTRIBUTE.CODE,
    ATTRIBUTE.NAME,
    ATTRIBUTE.MANUFACTURER_CODE
  FROM
    DEVICE_TYPE_ATTRIBUTE AS AT
  INNER JOIN
    DEVICE_TYPE_CLUSTER AS C
  ON
    C.DEVICE_TYPE_CLUSTER_ID = AT.DEVICE_TYPE_CLUSTER_REF
  LEFT JOIN 
    ATTRIBUTE
  ON
    AT.ATTRIBUTE_REF = ATTRIBUTE.ATTRIBUTE_ID
  WHERE
    C.DEVICE_TYPE_REF IN (?)`,
    [deviceTypeRef]
  )
  return rows.map(dbMapping.map.deviceTypeAttribute)
}

async function selectDeviceTypeCommandsByDeviceTypeRef(db, deviceTypeRef) {
  let rows = await dbApi.dbAll(
    db,
    `
  SELECT
    C.CLUSTER_REF,
    CMD.DEVICE_TYPE_CLUSTER_REF,
    CMD.COMMAND_REF,
    COMMAND.CODE,
    COMMAND.NAME,
    COMMAND.MANUFACTURER_CODE,
    COMMAND.SOURCE
  FROM
    DEVICE_TYPE_COMMAND AS CMD
  INNER JOIN
    DEVICE_TYPE_CLUSTER AS C
  ON
    C.DEVICE_TYPE_CLUSTER_ID = CMD.DEVICE_TYPE_CLUSTER_REF
  LEFT JOIN 
    COMMAND
  ON
    CMD.COMMAND_REF = COMMAND.COMMAND_ID
  WHERE
    C.DEVICE_TYPE_REF IN (?)`,
    [deviceTypeRef]
  )
  return rows.map(dbMapping.map.deviceTypeCommand)
}

/**
 * After loading up device type cluster table with the names,
 * this method links the refererence to actual cluster reference.
 *
 * @param {*} db
 * @returns promise of completion
 */
async function updateClusterReferencesForDeviceTypeClusters(db, packageId) {
  return dbApi.dbUpdate(
    db,
    `
UPDATE
  DEVICE_TYPE_CLUSTER
SET
  CLUSTER_REF =
  ( SELECT
      CLUSTER.CLUSTER_ID
    FROM
      CLUSTER
    WHERE
      lower(CLUSTER.NAME) = lower(DEVICE_TYPE_CLUSTER.CLUSTER_NAME)
    AND
      CLUSTER.PACKAGE_REF = ?
  )
WHERE
  ( SELECT PACKAGE_REF
    FROM DEVICE_TYPE
    WHERE DEVICE_TYPE_ID = DEVICE_TYPE_CLUSTER.DEVICE_TYPE_REF
  ) = ?`,
    [packageId, packageId]
  )
}

/**
 * After loading up device type attribute table with the names,
 * this method links the refererence to actual attribute reference.
 *
 * @param {*} db
 * @returns promise of completion
 */
async function updateAttributeReferencesForDeviceTypeReferences(db, packageId) {
  return dbApi.dbUpdate(
    db,
    `
UPDATE
  DEVICE_TYPE_ATTRIBUTE
SET
  ATTRIBUTE_REF =
  ( SELECT
      ATTRIBUTE.ATTRIBUTE_ID
    FROM
      ATTRIBUTE
    WHERE
      upper(ATTRIBUTE.DEFINE) = upper(DEVICE_TYPE_ATTRIBUTE.ATTRIBUTE_NAME)
    AND
      ATTRIBUTE.CLUSTER_REF = (
        SELECT
          DEVICE_TYPE_CLUSTER.CLUSTER_REF
        FROM
          DEVICE_TYPE_CLUSTER
        WHERE
          DEVICE_TYPE_CLUSTER_ID = DEVICE_TYPE_ATTRIBUTE.DEVICE_TYPE_CLUSTER_REF
      )
    AND
      ATTRIBUTE.PACKAGE_REF = ?
  )
WHERE
  DEVICE_TYPE_ATTRIBUTE.ATTRIBUTE_REF IS NULL
  `,
    [packageId]
  )
}

/**
 * After loading up device type command table with the names,
 * this method links the refererence to actual command reference.
 *
 * @param {*} db
 * @returns promise of completion
 */
async function updateCommandReferencesForDeviceTypeReferences(db, packageId) {
  return dbApi.dbUpdate(
    db,
    `
UPDATE
  DEVICE_TYPE_COMMAND
SET
  COMMAND_REF =
  ( SELECT
      COMMAND.COMMAND_ID
    FROM
      COMMAND
    WHERE
      upper(COMMAND.NAME) = upper(DEVICE_TYPE_COMMAND.COMMAND_NAME)
    AND
      COMMAND.CLUSTER_REF =
      ( SELECT
          DEVICE_TYPE_CLUSTER.CLUSTER_REF
        FROM
          DEVICE_TYPE_CLUSTER
        WHERE
          DEVICE_TYPE_CLUSTER_ID = DEVICE_TYPE_COMMAND.DEVICE_TYPE_CLUSTER_REF
      )
    AND
      COMMAND.PACKAGE_REF = ?
  )
WHERE
  DEVICE_TYPE_COMMAND.COMMAND_REF IS NULL`,
    [packageId]
  )
}

/**
 * After loading up device type feature table with the names,
 * this method links the refererence to actual feature reference.
 *
 * @param {*} db
 * @returns promise of completion
 */
async function updateFeatureReferencesForDeviceTypeReferences(db, packageId) {
  return dbApi.dbUpdate(
    db,
    `
UPDATE
  DEVICE_TYPE_FEATURE
SET
  FEATURE_REF =
  ( SELECT
      FEATURE.FEATURE_ID
    FROM
      FEATURE
    WHERE
      upper(FEATURE.CODE) = upper(DEVICE_TYPE_FEATURE.FEATURE_CODE)
    AND
      FEATURE.CLUSTER_REF = (
        SELECT
          DEVICE_TYPE_CLUSTER.CLUSTER_REF
        FROM
          DEVICE_TYPE_CLUSTER
        WHERE
          DEVICE_TYPE_CLUSTER_ID = DEVICE_TYPE_FEATURE.DEVICE_TYPE_CLUSTER_REF
      )
    AND
      FEATURE.PACKAGE_REF = ?
  )
WHERE
  DEVICE_TYPE_FEATURE.FEATURE_REF IS NULL`,
    [packageId]
  )
}

/**
 * This method returns the promise of linking the device type clusters
 * commands and attributes to the correct IDs in the cluster, attribute
 * and command tables.
 *
 * Initial load only populates the names, so once everything is loaded,
 * we have to link the foreign keys.
 *
 * @param {*} db
 * @returns promise of completed linking
 */
async function updateDeviceTypeEntityReferences(db, packageId) {
  await updateClusterReferencesForDeviceTypeClusters(db, packageId)
  await updateAttributeReferencesForDeviceTypeReferences(db, packageId)
  await updateCommandReferencesForDeviceTypeReferences(db, packageId)
  return updateFeatureReferencesForDeviceTypeReferences(db, packageId)
}

/**
 * Retrieves the zcl device type information along with the COMPOSITION from the DEVICE_TYPE table
 * based on an endpoint type id
 * @param {*} db
 * @param {*} endpointTypeId
 * @returns promise with zcl device type information and COMPOSITION based on endpoint type id
 */
async function selectDeviceTypesWithCompositionByEndpointTypeId(
  db,
  endpointTypeId
) {
  let rows = await dbApi.dbAll(
    db,
    `
  SELECT
    ETD.ENDPOINT_TYPE_DEVICE_ID,
    ETD.DEVICE_TYPE_REF,
    ETD.ENDPOINT_TYPE_REF,
    ETD.DEVICE_TYPE_ORDER,
    ETD.DEVICE_IDENTIFIER,
    ETD.DEVICE_VERSION,
    EC.TYPE
  FROM
    ENDPOINT_TYPE_DEVICE AS ETD
  JOIN
    DEVICE_TYPE AS DT ON ETD.DEVICE_TYPE_REF = DT.DEVICE_TYPE_ID
  LEFT JOIN
    ENDPOINT_COMPOSITION AS EC ON DT.CODE = EC.CODE
  WHERE
    ETD.ENDPOINT_TYPE_REF = ?`,
    [endpointTypeId]
  )
  return rows.map(dbMapping.map.endpointTypeDeviceExtended)
}

/**
 * Retrieves the zcl device type information based on an endpoint type id
 * @param {*} db
 * @param {*} endpointTypeId
 * @returns promise with zcl device type information based on endpoint type id
 */
async function selectDeviceTypesByEndpointTypeId(db, endpointTypeId) {
  let rows = await dbApi.dbAll(
    db,
    `
  SELECT
    ETD.ENDPOINT_TYPE_DEVICE_ID,
    ETD.DEVICE_TYPE_REF,
    ETD.ENDPOINT_TYPE_REF,
    ETD.DEVICE_TYPE_ORDER,
    ETD.DEVICE_IDENTIFIER,
    ETD.DEVICE_VERSION
  FROM
    ENDPOINT_TYPE_DEVICE AS ETD
  WHERE
    ETD.ENDPOINT_TYPE_REF = ?`,
    [endpointTypeId]
  )
  return rows.map(dbMapping.map.endpointTypeDevice)
}

/**
 * Retrieves the device type features associated to an endpoint type id and cluster id
 * Note: Use clusterId as 'all' to get all features for an endpoint type id.
 * @param {*} db
 * @param {*} endpointTypeId
 * @param {*} clusterId
 * @returns promise with zcl device type feature information based on endpoint type id and cluster id
 */
async function selectDeviceTypeFeaturesByEndpointTypeIdAndClusterId(
  db,
  endpointTypeId,
  clusterId
) {
  let rows = await dbApi.dbAll(
    db,
    `
  SELECT
    ETD.ENDPOINT_TYPE_DEVICE_ID,
    ETD.DEVICE_TYPE_REF,
    ETD.ENDPOINT_TYPE_REF,
    ETD.DEVICE_TYPE_ORDER,
    ETD.DEVICE_IDENTIFIER,
    ETD.DEVICE_VERSION,
    FEATURE.FEATURE_ID,
    FEATURE.NAME AS FEATURE_NAME,
    FEATURE.CODE AS FEATURE_CODE,
    FEATURE.BIT AS FEATURE_BIT,
    DEVICE_TYPE_CLUSTER.CLUSTER_REF
  FROM
    ENDPOINT_TYPE_DEVICE AS ETD
  INNER JOIN
    DEVICE_TYPE
  ON
    ETD.DEVICE_TYPE_REF = DEVICE_TYPE.DEVICE_TYPE_ID
  INNER JOIN
    DEVICE_TYPE_CLUSTER
  ON
    DEVICE_TYPE_CLUSTER.DEVICE_TYPE_REF = DEVICE_TYPE.DEVICE_TYPE_ID
  INNER JOIN
    DEVICE_TYPE_FEATURE
  ON
    DEVICE_TYPE_FEATURE.DEVICE_TYPE_CLUSTER_REF = DEVICE_TYPE_CLUSTER.DEVICE_TYPE_CLUSTER_ID
  INNER JOIN
    FEATURE
  ON
    FEATURE.FEATURE_ID = DEVICE_TYPE_FEATURE.FEATURE_REF
  WHERE
    ETD.ENDPOINT_TYPE_REF = ${endpointTypeId}` +
      (clusterId != 'all'
        ? ` AND
        DEVICE_TYPE_CLUSTER.CLUSTER_REF = ${clusterId}`
        : ``)
  )
  return rows.map(dbMapping.map.endpointTypeDeviceExtended)
}

exports.selectAllDeviceTypes = selectAllDeviceTypes
exports.selectDeviceTypeById = selectDeviceTypeById
exports.selectDeviceTypeByCodeAndName = selectDeviceTypeByCodeAndName
exports.selectDeviceTypeByCode = selectDeviceTypeByCode
exports.selectDeviceTypeClustersByDeviceTypeRef =
  selectDeviceTypeClustersByDeviceTypeRef
exports.selectDeviceTypeClusterByDeviceTypeClusterId =
  selectDeviceTypeClusterByDeviceTypeClusterId
exports.selectDeviceTypeAttributesByDeviceTypeRef =
  selectDeviceTypeAttributesByDeviceTypeRef
exports.selectDeviceTypeCommandsByDeviceTypeRef =
  selectDeviceTypeCommandsByDeviceTypeRef
exports.updateDeviceTypeEntityReferences = updateDeviceTypeEntityReferences
exports.selectDeviceTypesByEndpointTypeId = selectDeviceTypesByEndpointTypeId
exports.selectDeviceTypeFeaturesByEndpointTypeIdAndClusterId =
  selectDeviceTypeFeaturesByEndpointTypeIdAndClusterId
exports.selectDeviceTypesWithCompositionByEndpointTypeId =
  selectDeviceTypesWithCompositionByEndpointTypeId
