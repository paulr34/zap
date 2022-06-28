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

/**
 * This module provides queries related to cluster.
 *
 * @module DB API: cluster queries.
 */
const dbApi = require('./db-api.js')
const dbMapping = require('./db-mapping.js')

/**
 * All cluster details along with their attribute details per endpoint.
 * @param db
 * @param endpointsAndClusters
 * @returns cluster details along with their attribute details per endpoint.
 */
async function selectClusterDetailsFromEnabledClusters(
  db,
  endpointsAndClusters
) {
  let endpointClusterIds = endpointsAndClusters
    .map((ep) => ep.endpointClusterId)
    .toString()
  let mapFunction = (x) => {
    return {
      id: x.ATTRIBUTE_ID,
      name: x.NAME,
      code: x.CODE,
      side: x.SIDE,
      type: x.TYPE,
      define: x.DEFINE,
      mfgCode: x.MANUFACTURER_CODE,
      isWritable: x.IS_WRITABLE,
      clusterSide: x.CLUSTER_SIDE,
      clusterName: x.CLUSTER_NAME,
      clusterCode: x.CLUSTER_CODE,
      isClusterEnabled: x.ENABLED,
      isAttributeBounded: x.BOUNDED,
      storageOption: x.STORAGE_OPTION,
      isSingleton: x.SINGLETON,
      attributeMinValue: x.MIN,
      attributeMaxValue: x.MAX,
      defaultValue: x.DEFAULT_VALUE,
      attributeSize: x.ATOMIC_SIZE,
      clusterIndex: x.CLUSTER_INDEX,
      endpointIndex: x.ENDPOINT_INDEX,
      rowNumber: x.ROW_INDEX,
      attributeCount: x.ATTRIBUTE_COUNT,
      clusterCount: x.CLUSTER_COUNT,
      attributesSize: x.ATTRIBUTES_SIZE,
      endpointTypeId: x.ENDPOINT_TYPE_ID,
      endpointIdentifier: x.ENDPOINT_IDENTIFIER,
      mfgClusterCount: x.MANUFACTURING_SPECIFIC_CLUSTER_COUNT,
    }
  }
  return dbApi
    .dbAll(
      db,
      `
  SELECT
    *,
    COUNT(MANUFACTURER_CODE) OVER () AS MANUFACTURING_SPECIFIC_CLUSTER_COUNT FROM (
  SELECT
    ATTRIBUTE.ATTRIBUTE_ID AS ATTRIBUTE_ID,
    ATTRIBUTE.NAME AS NAME,
    ATTRIBUTE.CODE AS CODE,
    ATTRIBUTE.SIDE AS SIDE,
    ATTRIBUTE.TYPE AS TYPE,
    ATTRIBUTE.DEFINE AS DEFINE,
    CLUSTER.MANUFACTURER_CODE AS MANUFACTURER_CODE,
    ATTRIBUTE.IS_WRITABLE AS IS_WRITABLE,
    ENDPOINT_TYPE_CLUSTER.SIDE AS CLUSTER_SIDE,
    CLUSTER.NAME AS CLUSTER_NAME,
    CLUSTER.CODE AS CLUSTER_CODE,
    ENDPOINT_TYPE_CLUSTER.ENABLED AS ENABLED,
    ENDPOINT_TYPE_ATTRIBUTE.BOUNDED AS BOUNDED,
    ENDPOINT_TYPE_ATTRIBUTE.STORAGE_OPTION AS STORAGE_OPTION,
    ENDPOINT_TYPE_ATTRIBUTE.SINGLETON AS SINGLETON,
    ATTRIBUTE.MIN AS MIN,
    ATTRIBUTE.MAX AS MAX,
    ENDPOINT_TYPE_ATTRIBUTE.DEFAULT_VALUE AS DEFAULT_VALUE,
    CASE
      WHEN ATOMIC.IS_STRING=1 THEN 
        CASE WHEN ATOMIC.IS_LONG=0 THEN ATTRIBUTE.MAX_LENGTH+1
             WHEN ATOMIC.IS_LONG=1 THEN ATTRIBUTE.MAX_LENGTH+2
             ELSE ATOMIC.ATOMIC_SIZE
             END
        WHEN ATOMIC.ATOMIC_SIZE IS NULL THEN ATTRIBUTE.MAX_LENGTH
        ELSE ATOMIC.ATOMIC_SIZE
    END AS ATOMIC_SIZE,
    ROW_NUMBER() OVER (PARTITION BY ENDPOINT.ENDPOINT_IDENTIFIER, CLUSTER.MANUFACTURER_CODE, CLUSTER.CODE, ENDPOINT_TYPE_CLUSTER.SIDE) CLUSTER_INDEX,
    ROW_NUMBER() OVER (PARTITION BY ENDPOINT.ENDPOINT_IDENTIFIER ORDER BY ENDPOINT.ENDPOINT_IDENTIFIER, CLUSTER.MANUFACTURER_CODE, CLUSTER.CODE, ENDPOINT_TYPE_CLUSTER.SIDE) ENDPOINT_INDEX,
    ROW_NUMBER() OVER () ROW_INDEX,
    COUNT(ATTRIBUTE.CODE) OVER (PARTITION BY ENDPOINT.ENDPOINT_IDENTIFIER, CLUSTER.MANUFACTURER_CODE, CLUSTER.CODE, ENDPOINT_TYPE_CLUSTER.SIDE) ATTRIBUTE_COUNT,
    COUNT(CLUSTER.CODE) OVER (PARTITION BY ENDPOINT.ENDPOINT_IDENTIFIER, CLUSTER.MANUFACTURER_CODE, CLUSTER.CODE) CLUSTER_COUNT,
    SUM(CASE
          WHEN
            (ENDPOINT_TYPE_ATTRIBUTE.SINGLETON != 1 AND ENDPOINT_TYPE_ATTRIBUTE.STORAGE_OPTION != "External")
          THEN
            (CASE
              WHEN
                ATOMIC.IS_STRING=1
              THEN 
                CASE
                  WHEN
                    ATOMIC.IS_LONG=0
                  THEN
                    ATTRIBUTE.MAX_LENGTH+1
                  WHEN
                    ATOMIC.IS_LONG=1
                  THEN
                  ATTRIBUTE.MAX_LENGTH+2
                ELSE
                  ATOMIC.ATOMIC_SIZE
                END
              WHEN
                ATOMIC.ATOMIC_SIZE IS NULL
              THEN
                ATTRIBUTE.MAX_LENGTH
              ELSE
                ATOMIC.ATOMIC_SIZE
            END)
          ELSE
            0
        END) OVER (PARTITION BY ENDPOINT.ENDPOINT_IDENTIFIER, CLUSTER.MANUFACTURER_CODE, CLUSTER.CODE, ENDPOINT_TYPE_CLUSTER.SIDE) ATTRIBUTES_SIZE,
    ENDPOINT_TYPE.ENDPOINT_TYPE_ID AS ENDPOINT_TYPE_ID,
    ENDPOINT.ENDPOINT_IDENTIFIER AS ENDPOINT_IDENTIFIER
  FROM
    ATTRIBUTE
  INNER JOIN
    ENDPOINT_TYPE_ATTRIBUTE
  ON
    ATTRIBUTE.ATTRIBUTE_ID = ENDPOINT_TYPE_ATTRIBUTE.ATTRIBUTE_REF
  INNER JOIN
    ENDPOINT_TYPE_CLUSTER
  ON
    ENDPOINT_TYPE_ATTRIBUTE.ENDPOINT_TYPE_CLUSTER_REF = ENDPOINT_TYPE_CLUSTER.ENDPOINT_TYPE_CLUSTER_ID
  INNER JOIN
    CLUSTER
  ON
    ENDPOINT_TYPE_CLUSTER.CLUSTER_REF = CLUSTER.CLUSTER_ID
  INNER JOIN
    ATOMIC
  ON
    ATOMIC.NAME = ATTRIBUTE.TYPE
  INNER JOIN
    ENDPOINT_TYPE
  ON
    ENDPOINT_TYPE.ENDPOINT_TYPE_ID = ENDPOINT_TYPE_CLUSTER.ENDPOINT_TYPE_REF
  INNER JOIN
    ENDPOINT
  ON
    ENDPOINT.ENDPOINT_TYPE_REF = ENDPOINT_TYPE.ENDPOINT_TYPE_ID
  WHERE
    ENDPOINT_TYPE_ATTRIBUTE.ENDPOINT_TYPE_CLUSTER_REF IN (${endpointClusterIds})
    AND ENDPOINT_TYPE_CLUSTER.ENABLED = 1
    AND ENDPOINT_TYPE_ATTRIBUTE.INCLUDED = 1
    AND ENDPOINT_TYPE_CLUSTER.SIDE = ATTRIBUTE.SIDE
  GROUP BY
    ENDPOINT.ENDPOINT_IDENTIFIER,
    CLUSTER.NAME,
    ENDPOINT_TYPE_CLUSTER.SIDE,
    ATTRIBUTE.NAME )
WHERE
  CLUSTER_INDEX = 1
ORDER BY
  ENDPOINT_IDENTIFIER, CLUSTER_CODE, CLUSTER_SIDE
        `
    )
    .then((rows) => rows.map(mapFunction))
}

exports.selectClusterDetailsFromEnabledClusters =
  selectClusterDetailsFromEnabledClusters
