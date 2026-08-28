#!/usr/bin/env node
/**
 * Exploratory builder: create fancy Matter and Zigbee .zap apps from device
 * types, enable the clusters those types require, then validate and generate.
 * Failures are recorded, not fixed.
 */

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const dbApi = require('../../../src-electron/db/db-api')
const env = require('../../../src-electron/util/env')
const zclLoader = require('../../../src-electron/zcl/zcl-loader')
const genEngine = require('../../../src-electron/generator/generation-engine')
const exportJs = require('../../../src-electron/importexport/export')
const importJs = require('../../../src-electron/importexport/import')
const querySession = require('../../../src-electron/db/query-session')
const queryConfig = require('../../../src-electron/db/query-config')
const queryEndpoint = require('../../../src-electron/db/query-endpoint')
const queryEndpointType = require('../../../src-electron/db/query-endpoint-type')
const queryDeviceType = require('../../../src-electron/db/query-device-type')
const queryZcl = require('../../../src-electron/db/query-zcl')
const zclComponents = require('../../../src-electron/ide-integration/zcl-components')
const validateAll = require('../../../src-electron/validation/validate-all')
const testQuery = require('../../test-query')
const util = require('../../../src-electron/util/util')

const OUT_DIR = __dirname
const GEN_OUT = path.join(OUT_DIR, 'generated')
const REPORT_PATH = path.join(OUT_DIR, 'BUG-REPORT.md')
const REPO_ROOT = path.join(__dirname, '../../..')

const MATTER_ZCL = env.builtinMatterZclMetafile()
const MATTER_GEN = './test/gen-template/matter/gen-test.json'
const ZIGBEE_ZCL = env.builtinSilabsZclMetafile()
const ZIGBEE_GEN = './test/gen-template/zigbee2/gen-templates.json'
const ZIGBEE_GEN_BASIC = './test/gen-template/zigbee/gen-templates.json'
const MULTI_MATTER_ZCL = './zcl-builtin/matter/zcl-with-test-extensions.json'

const APP_SPECS = [
  {
    name: 'matter-smart-home-hub',
    protocol: 'matter',
    zcl: MATTER_ZCL,
    gen: MATTER_GEN,
    endpoints: [
      { id: 0, deviceTypes: ['MA-rootdevice'], name: 'Root' },
      {
        id: 1,
        deviceTypes: ['MA-extendedcolorlight'],
        name: 'LivingRoomLight',
        parent: 0,
        extraClusters: [{ name: 'Occupancy Sensing', side: 'server' }]
      },
      { id: 2, deviceTypes: ['MA-thermostat'], name: 'Thermostat', parent: 0 },
      { id: 3, deviceTypes: ['MA-doorlock'], name: 'FrontDoorLock', parent: 0 },
      {
        id: 4,
        deviceTypes: ['MA-contactsensor'],
        name: 'DoorContact',
        parent: 0
      },
      { id: 5, deviceTypes: ['MA-windowcovering'], name: 'Blinds', parent: 0 }
    ]
  },
  {
    name: 'matter-rainbow-light',
    protocol: 'matter',
    zcl: MATTER_ZCL,
    gen: MATTER_GEN,
    endpoints: [
      {
        id: 1,
        deviceTypes: [
          'MA-onofflight',
          'MA-dimmablelight',
          'MA-colortemperaturelight',
          'MA-extendedcolorlight'
        ],
        name: 'RainbowLight'
      }
    ]
  },
  {
    name: 'matter-kitchen-suite',
    protocol: 'matter',
    zcl: MATTER_ZCL,
    gen: MATTER_GEN,
    endpoints: [
      { id: 0, deviceTypes: ['MA-rootdevice'], name: 'Root' },
      { id: 1, deviceTypes: ['MA-refrigerator'], name: 'Fridge', parent: 0 },
      {
        id: 2,
        deviceTypes: ['MA-temperature-controlled-cabinet'],
        name: 'WineCooler',
        parent: 0
      },
      { id: 3, deviceTypes: ['MA-fan'], name: 'RangeHoodFan', parent: 0 }
    ]
  },
  {
    name: 'matter-composed-simple-types',
    protocol: 'matter',
    zcl: MATTER_ZCL,
    gen: MATTER_GEN,
    note: 'Intentionally combines two Simple-class device types on one endpoint',
    endpoints: [
      {
        id: 1,
        deviceTypes: ['MA-refrigerator', 'MA-temperature-controlled-cabinet'],
        name: 'IllegalSimpleCombo'
      }
    ]
  },
  {
    name: 'matter-sensor-array',
    protocol: 'matter',
    zcl: MATTER_ZCL,
    gen: MATTER_GEN,
    endpoints: [
      { id: 0, deviceTypes: ['MA-rootdevice'], name: 'Root' },
      { id: 1, deviceTypes: ['MA-tempsensor'], name: 'Temp', parent: 0 },
      {
        id: 2,
        deviceTypes: ['MA-humiditysensor'],
        name: 'Humidity',
        parent: 0
      },
      {
        id: 3,
        deviceTypes: ['MA-pressuresensor'],
        name: 'Pressure',
        parent: 0
      },
      {
        id: 4,
        deviceTypes: ['MA-occupancysensor'],
        name: 'Occupancy',
        parent: 0
      },
      { id: 5, deviceTypes: ['MA-lightsensor'], name: 'Light', parent: 0 },
      { id: 6, deviceTypes: ['MA-flowsensor'], name: 'Flow', parent: 0 }
    ]
  },
  {
    name: 'matter-bridge-composition',
    protocol: 'matter',
    zcl: MATTER_ZCL,
    gen: MATTER_GEN,
    endpoints: [
      { id: 0, deviceTypes: ['MA-rootdevice'], name: 'Root' },
      { id: 1, deviceTypes: ['MA-aggregator'], name: 'Aggregator', parent: 0 },
      {
        id: 2,
        deviceTypes: ['MA-bridgeddevice'],
        name: 'BridgedNode',
        parent: 1
      },
      { id: 3, deviceTypes: ['MA-onofflight'], name: 'BridgedOnOff', parent: 1 }
    ]
  },
  {
    name: 'zigbee-smart-home',
    protocol: 'zigbee',
    zcl: ZIGBEE_ZCL,
    gen: ZIGBEE_GEN,
    endpoints: [
      { id: 1, deviceTypes: ['HA-doorlock'], name: 'FrontDoorLock' },
      { id: 2, deviceTypes: ['HA-tstat'], name: 'Thermostat' },
      { id: 3, deviceTypes: ['HA-colordimmablelight'], name: 'ColorLight' },
      { id: 4, deviceTypes: ['HA-occupancysensor'], name: 'MotionSensor' },
      { id: 5, deviceTypes: ['HA-windowcovering'], name: 'Shade' }
    ]
  },
  {
    name: 'zigbee-zll-showroom',
    protocol: 'zigbee',
    zcl: ZIGBEE_ZCL,
    gen: ZIGBEE_GEN,
    endpoints: [
      { id: 1, deviceTypes: ['ZLL-extendedcolorlight'], name: 'ShowroomLight' },
      { id: 2, deviceTypes: ['ZLL-controlbridge'], name: 'Bridge' },
      { id: 3, deviceTypes: ['ZLL-colorsceneremote'], name: 'SceneRemote' },
      { id: 4, deviceTypes: ['ZLL-colortemperaturelight'], name: 'WarmLight' }
    ]
  },
  {
    name: 'zigbee-energy-hub',
    protocol: 'zigbee',
    zcl: ZIGBEE_ZCL,
    gen: ZIGBEE_GEN,
    endpoints: [
      {
        id: 1,
        deviceTypes: ['HA-combinedinterface'],
        name: 'EnergyInterface'
      },
      { id: 2, deviceTypes: ['HA-rangeextender'], name: 'RangeExtender' },
      { id: 3, deviceTypes: ['HA-mpo'], name: 'MeteringPoint' },
      { id: 4, deviceTypes: ['HA-doorlockcontroller'], name: 'LockController' }
    ]
  },
  {
    name: 'multiprotocol-bridge',
    protocol: 'multiprotocol',
    zcl: [MULTI_MATTER_ZCL, ZIGBEE_ZCL],
    gen: [MATTER_GEN, ZIGBEE_GEN_BASIC],
    partitions: 2,
    endpoints: [
      {
        id: 0,
        deviceTypes: ['MA-rootdevice'],
        name: 'MatterRoot',
        partition: 0
      },
      {
        id: 1,
        deviceTypes: ['MA-extendedcolorlight'],
        name: 'MatterLight',
        parent: 0,
        partition: 0
      },
      {
        id: 10,
        deviceTypes: ['ZLL-dimmablelight'],
        name: 'ZigbeeLight',
        partition: 1
      }
    ]
  }
]

function asArray(x) {
  return Array.isArray(x) ? x : [x]
}

function findDeviceTypes(allDeviceTypes, labels) {
  const found = []
  const missing = []
  for (const label of labels) {
    const dt = allDeviceTypes.find((d) => d.label === label)
    if (dt) found.push(dt)
    else missing.push(label)
  }
  return { found, missing }
}

async function createSessionForSpec(
  db,
  spec,
  zclPackageIds,
  templatePackageIds
) {
  if (spec.protocol !== 'multiprotocol') {
    return testQuery.createSession(
      db,
      'fancy-apps',
      `session-${spec.name}`,
      spec.zcl,
      spec.gen
    )
  }

  const userSession = await querySession.ensureZapUserAndSession(
    db,
    'fancy-apps',
    `session-${spec.name}`,
    { partitions: spec.partitions || 2 }
  )
  const zclPkgs = asArray(zclPackageIds).map((id) => ({ id }))
  const genPkgs = asArray(templatePackageIds).map((id) => ({ id }))
  await util.ensurePackagesAndPopulateSessionOptions(
    db,
    userSession.sessionId,
    { partitions: spec.partitions || 2 },
    zclPkgs,
    genPkgs
  )
  return userSession.sessionId
}

async function enableExtraClusters(
  db,
  endpointTypeId,
  packageId,
  extras,
  issues,
  endpointId
) {
  if (!extras || extras.length === 0) return
  const clusters = await queryZcl.selectAllClusters(db, packageId)
  for (const extra of extras) {
    const cluster = clusters.find(
      (c) => c.name.toLowerCase() === extra.name.toLowerCase()
    )
    if (!cluster) {
      issues.push({
        type: 'extra_cluster_not_found',
        endpoint: endpointId,
        cluster: extra.name
      })
      continue
    }
    try {
      await queryConfig.setClusterIncluded(
        db,
        packageId,
        endpointTypeId,
        cluster.code,
        true,
        extra.side
      )
    } catch (err) {
      issues.push({
        type: 'extra_cluster_enable_failed',
        endpoint: endpointId,
        cluster: extra.name,
        error: err.message
      })
    }
  }
}

async function deviceTypeCoverage(db, endpointTypeId, deviceTypes) {
  const enabled = await queryEndpoint.selectEndpointClusters(db, endpointTypeId)
  const enabledKeys = new Set(
    enabled.map((c) => `${c.name.toLowerCase()}:${c.side}`)
  )
  const missingRequired = []
  for (const dt of deviceTypes) {
    const dtClusters =
      await queryDeviceType.selectDeviceTypeClustersByDeviceTypeRef(db, dt.id)
    for (const dtc of dtClusters) {
      const name = (dtc.clusterName || '').toLowerCase()
      if (dtc.includeServer && dtc.lockServer) {
        if (!enabledKeys.has(`${name}:server`)) {
          missingRequired.push({
            deviceType: dt.label,
            cluster: dtc.clusterName,
            side: 'server'
          })
        }
      }
      if (dtc.includeClient && dtc.lockClient) {
        if (!enabledKeys.has(`${name}:client`)) {
          missingRequired.push({
            deviceType: dt.label,
            cluster: dtc.clusterName,
            side: 'client'
          })
        }
      }
    }
  }
  return {
    enabledCount: enabled.length,
    enabled: enabled.map((c) => ({ name: c.name, side: c.side, code: c.code })),
    missingRequired
  }
}

async function createApp(db, spec, zclPackageIds, templatePackageIds) {
  const sessionId = await createSessionForSpec(
    db,
    spec,
    zclPackageIds,
    templatePackageIds
  )
  const endpointDbIds = {}
  const issues = []
  const coverage = []

  for (const epSpec of spec.endpoints) {
    const partitionIndex = epSpec.partition ?? 0
    const zclPackageId =
      asArray(zclPackageIds)[partitionIndex] ?? asArray(zclPackageIds)[0]

    const allDeviceTypes = await queryDeviceType.selectAllDeviceTypes(
      db,
      zclPackageId
    )
    const { found, missing } = findDeviceTypes(
      allDeviceTypes,
      epSpec.deviceTypes
    )
    if (missing.length) {
      issues.push({
        type: 'missing_device_type',
        endpoint: epSpec.id,
        missing
      })
      continue
    }

    const sessionPartitionInfo =
      await querySession.selectSessionPartitionInfoFromDeviceType(
        db,
        sessionId,
        found[0].id
      )
    const partitionInfo =
      sessionPartitionInfo.find(
        (p) => p.sessionPartitionNumber === partitionIndex
      ) ||
      sessionPartitionInfo[partitionIndex] ||
      sessionPartitionInfo[0]

    if (!partitionInfo) {
      issues.push({
        type: 'no_session_partition',
        endpoint: epSpec.id,
        deviceTypes: epSpec.deviceTypes
      })
      continue
    }

    let endpointTypeId
    try {
      endpointTypeId = await queryConfig.insertEndpointType(
        db,
        partitionInfo,
        epSpec.name,
        found.map((d) => d.id),
        found.map((d) => d.code),
        found.map(() => 1),
        true
      )
    } catch (err) {
      issues.push({
        type: 'insert_endpoint_type_failed',
        endpoint: epSpec.id,
        deviceTypes: epSpec.deviceTypes,
        error: err.message
      })
      continue
    }

    await enableExtraClusters(
      db,
      endpointTypeId,
      zclPackageId,
      epSpec.extraClusters,
      issues,
      epSpec.id
    )

    coverage.push({
      endpoint: epSpec.id,
      name: epSpec.name,
      deviceTypes: epSpec.deviceTypes,
      ...(await deviceTypeCoverage(db, endpointTypeId, found))
    })

    const profileId = spec.protocol === 'zigbee' ? 260 : 259
    let parentRef = null
    if (epSpec.parent != null) {
      parentRef = endpointDbIds[epSpec.parent]
      if (parentRef == null) {
        issues.push({
          type: 'parent_endpoint_missing',
          endpoint: epSpec.id,
          parent: epSpec.parent
        })
      }
    }

    try {
      const endpointDbId = await queryEndpoint.insertEndpoint(
        db,
        sessionId,
        epSpec.id,
        endpointTypeId,
        0,
        profileId,
        parentRef ?? null
      )
      endpointDbIds[epSpec.id] = endpointDbId
    } catch (err) {
      issues.push({
        type: 'insert_endpoint_failed',
        endpoint: epSpec.id,
        error: err.message
      })
    }
  }

  const zapPath = path.join(OUT_DIR, `${spec.name}.zap`)
  await exportJs.exportDataIntoFile(db, sessionId, zapPath, { removeLog: true })
  return {
    sessionId,
    zapPath,
    issues,
    coverage,
    templatePackageId: asArray(templatePackageIds)[0]
  }
}

async function checkComponents(db, sessionId) {
  const components = new Set()
  const missingMapping = []
  const endpointTypes = await queryEndpointType.selectAllEndpointTypes(
    db,
    sessionId
  )

  for (const et of endpointTypes) {
    const clusters = await queryEndpoint.selectEndpointClusters(db, et.id)
    for (const cl of clusters) {
      const compIds = await zclComponents.getComponentIdsByCluster(
        db,
        sessionId,
        cl.clusterId,
        [cl.side]
      )
      if (compIds.length === 0) {
        missingMapping.push({
          cluster: cl.name,
          side: cl.side,
          endpointType: et.name
        })
      }
      compIds.forEach((c) => components.add(c))
    }
  }
  return { components: [...components], missingMapping }
}

async function generateApp(db, sessionId, templatePackageId, outSubdir) {
  const outPath = path.join(GEN_OUT, outSubdir)
  fs.mkdirSync(outPath, { recursive: true })
  try {
    const genResult = await genEngine.generateAndWriteFiles(
      db,
      sessionId,
      templatePackageId,
      outPath,
      {
        disableDeprecationWarnings: true,
        logger: () => {}
      }
    )
    const files = fs.existsSync(outPath) ? fs.readdirSync(outPath) : []
    return {
      success: !genResult.hasErrors,
      hasErrors: genResult.hasErrors,
      error: genResult.hasErrors
        ? JSON.stringify(genResult.errors).slice(0, 500)
        : null,
      fileCount: files.length,
      outPath
    }
  } catch (err) {
    return { success: false, error: err.message, outPath, fileCount: 0 }
  }
}

function summarizeValidation(report) {
  if (!report || report.error) return report
  const attrIssues = (report.attributes || []).filter((a) => a.issues?.length)
  const epIssues = (report.endpoints || []).filter(
    (e) =>
      (e.issues?.endpointId || []).length || (e.issues?.networkId || []).length
  )
  const conformance = report.conformance || []
  return {
    summary: report.summary,
    attributeIssueCount: attrIssues.length,
    endpointIssueCount: epIssues.length,
    conformanceCount: conformance.length,
    attributeSamples: attrIssues.slice(0, 5).map((a) => ({
      cluster: a.clusterName,
      attribute: a.attributeName,
      issues: a.issues,
      defaultValue: a.defaultValue
    })),
    endpointSamples: epIssues.slice(0, 5).map((e) => ({
      endpointId: e.endpointId,
      issues: e.issues
    })),
    conformanceSamples: conformance.slice(0, 5).map((c) => ({
      cluster: c.clusterName,
      warnings: (c.warnings || c.issues || []).slice?.(0, 3) || c
    }))
  }
}

async function validateZapFile(spec, zapPath) {
  const dbFile = env.sqliteTestFile(`fancy-validate-${spec.name}`)
  const db = await dbApi.initDatabaseAndLoadSchema(
    dbFile,
    env.schemaFile(),
    env.zapVersion()
  )
  try {
    for (const z of asArray(spec.zcl)) await zclLoader.loadZcl(db, z)
    for (const g of asArray(spec.gen)) await genEngine.loadTemplates(db, g)
    const sessionId = await querySession.createBlankSession(db)
    await importJs.importDataFromFile(db, zapPath, { sessionId })
    const report = await validateAll.validateAll(db, sessionId)
    return summarizeValidation(report)
  } catch (err) {
    return { error: err.message }
  } finally {
    await dbApi.closeDatabase(db)
  }
}

function runCliValidate(appResults) {
  const results = []
  fs.mkdirSync(path.join(GEN_OUT, 'validate-reports'), { recursive: true })
  for (const r of appResults) {
    if (!fs.existsSync(r.zapPath)) continue
    const reportPath = path.join(
      GEN_OUT,
      'validate-reports',
      path.basename(r.zapPath, '.zap') + '.json'
    )
    const zclFlags = asArray(r.spec.zcl)
      .map((z) => `-z ${z}`)
      .join(' ')
    const genFlags = asArray(r.spec.gen)
      .map((g) => `-g ${g}`)
      .join(' ')
    const cmd = `node src-script/zap-start.js validate -i ${r.zapPath} ${zclFlags} ${genFlags} -o ${reportPath}`
    const spawned = spawnSync(cmd, {
      shell: true,
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024
    })
    let report = null
    try {
      report = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
    } catch (_) {
      report = {
        parseError: true,
        stderrTail: (spawned.stderr || '').slice(-1500)
      }
    }
    results.push({
      zap: r.zapPath,
      name: r.spec.name,
      exitCode: spawned.status,
      report
    })
  }
  return results
}

function buildReport(appResults, cliValidateResults) {
  const lines = [
    '# Fancy Matter & Zigbee Apps — Bug Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    'Exploratory run that created multi-endpoint Matter, Zigbee, and multi-protocol ZAP configurations from device types, enabled the clusters those types require (plus a few extra clusters on the hub light), then validated and generated. **No product-code fixes were applied.**',
    '',
    'UC component install was checked via gen-template cluster→component mapping only. There is no Simplicity Studio session here, so components cannot actually be installed — missing mappings are reported as potential gaps.',
    '',
    '## Apps Created',
    ''
  ]

  for (const r of appResults) {
    lines.push(`### ${r.spec.name} (\`${path.basename(r.zapPath)}\`)`)
    lines.push('')
    lines.push(`- Protocol: **${r.spec.protocol}**`)
    if (r.spec.note) lines.push(`- Note: ${r.spec.note}`)
    lines.push(`- Endpoints requested: ${r.spec.endpoints.length}`)
    if (r.buildIssues.length) {
      lines.push('- **Issues while creating the app:**')
      for (const issue of r.buildIssues) {
        lines.push(
          `  - \`${issue.type}\` endpoint ${issue.endpoint}: ${JSON.stringify(issue.error || issue.missing || issue.cluster || issue.deviceTypes || issue.parent)}`
        )
      }
    }
    const missingReq = (r.coverage || []).flatMap((c) =>
      (c.missingRequired || []).map((m) => ({ endpoint: c.endpoint, ...m }))
    )
    if (missingReq.length) {
      lines.push(
        `- **Locked device-type clusters not enabled:** ${missingReq.length}`
      )
      for (const m of missingReq.slice(0, 8)) {
        lines.push(
          `  - ep ${m.endpoint} ${m.deviceType}: ${m.cluster} (${m.side})`
        )
      }
    }
    const enabledTotal = (r.coverage || []).reduce(
      (n, c) => n + (c.enabledCount || 0),
      0
    )
    lines.push(`- Enabled endpoint-type clusters: ${enabledTotal}`)
    lines.push(
      `- UC component ids from mapping (${r.components.components.length}): ${r.components.components.slice(0, 10).join(', ') || '(none)'}${r.components.components.length > 10 ? '…' : ''}`
    )
    if (r.components.missingMapping.length) {
      const uniqueClusters = [
        ...new Set(
          r.components.missingMapping.map((m) => `${m.cluster}/${m.side}`)
        )
      ]
      lines.push(
        `- Clusters with **no UC component mapping**: ${uniqueClusters.length} unique (${r.components.missingMapping.length} endpoint-cluster rows)`
      )
      for (const c of uniqueClusters.slice(0, 8)) {
        lines.push(`  - ${c}`)
      }
      if (uniqueClusters.length > 8) {
        lines.push(`  - … and ${uniqueClusters.length - 8} more`)
      }
    }
    if (r.generation) {
      lines.push(
        `- Code generation: ${r.generation.success ? 'OK' : '**FAILED**'} (${r.generation.fileCount || 0} files)`
      )
      if (r.generation.error) {
        lines.push(`  - Error: \`${String(r.generation.error).slice(0, 300)}\``)
      }
    }
    if (r.validation?.error) {
      lines.push(`- In-process validation error: ${r.validation.error}`)
    } else if (r.validation?.summary) {
      lines.push(
        `- In-process validation: ${r.validation.summary.errors} errors, ${r.validation.attributeIssueCount} attribute findings, ${r.validation.endpointIssueCount} endpoint findings, ${r.validation.conformanceCount} conformance buckets`
      )
    }
    lines.push('')
  }

  lines.push('## CLI `zap validate` Results')
  lines.push('')
  for (const vr of cliValidateResults) {
    const errors = vr.report?.results?.[0]?.summary?.errors ?? '?'
    const warnings = vr.report?.results?.[0]?.summary?.warnings ?? '?'
    lines.push(
      `- **${vr.name}**: exit ${vr.exitCode}, ${errors} errors, ${warnings} warnings`
    )
    if (vr.report?.parseError) {
      lines.push(`  - Could not parse report. stderr: ${vr.report.stderrTail}`)
    }
  }

  lines.push('')
  lines.push('## Potential Bugs')
  lines.push('')

  let n = 1
  const seen = new Set()

  function bug(title, body) {
    const key = title + body.slice(0, 80)
    if (seen.has(key)) return
    seen.add(key)
    lines.push(`### Bug ${n++}: ${title}`)
    lines.push('')
    lines.push(body)
    lines.push('')
  }

  for (const r of appResults) {
    for (const issue of r.buildIssues) {
      if (issue.type === 'insert_endpoint_type_failed') {
        bug(
          `insertEndpointType failed — ${r.spec.name}`,
          `Creating endpoint ${issue.endpoint} with device types \`${(issue.deviceTypes || []).join(', ')}\` threw:\n\n\`\`\`\n${issue.error}\n\`\`\`\n\nThis may be expected for Simple-class Matter composition (two application device types on one simple endpoint), or it may be an overly strict trigger.`
        )
      } else if (issue.type === 'missing_device_type') {
        bug(
          `Device type not found — ${r.spec.name}`,
          `Endpoint ${issue.endpoint} requested types that are not in the loaded ZCL package: ${JSON.stringify(issue.missing)}`
        )
      } else if (issue.type === 'insert_endpoint_failed') {
        bug(
          `insertEndpoint failed — ${r.spec.name}`,
          `Endpoint ${issue.endpoint}: ${issue.error}`
        )
      } else if (issue.type === 'extra_cluster_enable_failed') {
        bug(
          `Enabling extra cluster failed — ${r.spec.name}`,
          `Endpoint ${issue.endpoint} cluster ${issue.cluster}: ${issue.error}`
        )
      }
    }

    const missingReq = (r.coverage || []).flatMap((c) =>
      (c.missingRequired || []).map((m) => ({ endpoint: c.endpoint, ...m }))
    )
    if (missingReq.length) {
      bug(
        `Device-type locked clusters not auto-enabled — ${r.spec.name}`,
        `After \`insertEndpointType\` / \`setEndpointDefaults\`, these locked includeClient/includeServer clusters were not enabled:\n\n\`\`\`json\n${JSON.stringify(missingReq.slice(0, 20), null, 2)}\n\`\`\``
      )
    }

    if (r.generation && !r.generation.success) {
      bug(
        `Code generation failed — ${r.spec.name}`,
        `\`generateAndWriteFiles\` failed: ${r.generation.error}`
      )
    }

    if (
      r.validation &&
      !r.validation.error &&
      r.validation.summary?.errors > 0
    ) {
      bug(
        `Validation errors on newly created app — ${r.spec.name}`,
        `In-process \`validateAll\` reported ${r.validation.summary.errors} errors. Samples:\n\nAttributes:\n\`\`\`json\n${JSON.stringify(r.validation.attributeSamples, null, 2)}\n\`\`\`\n\nEndpoints:\n\`\`\`json\n${JSON.stringify(r.validation.endpointSamples, null, 2)}\n\`\`\``
      )
    }

    const isZigbee = r.spec.protocol === 'zigbee'
    if (isZigbee && r.components.missingMapping.length > 5) {
      const unique = [
        ...new Set(
          r.components.missingMapping.map((m) => `${m.cluster}/${m.side}`)
        )
      ]
      bug(
        `Zigbee cluster→UC component mapping gaps — ${r.spec.name}`,
        `zigbee2 gen-templates declare \`autoEnableComponents\` and \`cluster-to-component-dependencies.json\`, but these enabled clusters have no mapping (Studio would not auto-install a component):\n\n${unique.map((c) => `- ${c}`).join('\n')}`
      )
    }
  }

  for (const vr of cliValidateResults) {
    if (vr.exitCode !== 0 && vr.report?.results?.[0]) {
      const s = vr.report.results[0].summary
      bug(
        `CLI validate non-zero exit — ${vr.name}`,
        `\`zap validate\` exit ${vr.exitCode}: ${s.errors} errors, ${s.warnings} warnings. This is a freshly created file from device-type defaults, so errors here are likely default-value or endpoint-id issues rather than user misconfiguration.`
      )
    }
  }

  const networkIdBugs = []
  for (const vr of cliValidateResults) {
    for (const ep of vr.report?.results?.[0]?.endpoints || []) {
      const nids = ep.issues?.networkId || []
      if (nids.length)
        networkIdBugs.push({ app: vr.name, ep: ep.endpointId, nids })
    }
  }
  if (networkIdBugs.length) {
    bug(
      'NetworkId reported invalid on newly inserted endpoints',
      `Endpoints were inserted with numeric \`networkIdentifier = 0\`, but validate still reports NetworkId issues:\n\n\`\`\`json\n${JSON.stringify(networkIdBugs, null, 2)}\n\`\`\`\n\nExisting fixture \`test/resource/matter-test.zap\` showed the same finding ("NetworkId is invalid number string"). Possible validator treating 0 / null / string inconsistently.`
    )
  }

  const attrDefaultBugs = []
  for (const r of appResults) {
    if (r.validation?.attributeSamples?.length) {
      attrDefaultBugs.push({
        app: r.spec.name,
        samples: r.validation.attributeSamples
      })
    }
  }
  if (attrDefaultBugs.length) {
    bug(
      'Device-type defaults leave attributes out of range or empty',
      `Several newly created apps enable mandatory attributes whose default is empty or out of range. That matches existing fixtures (e.g. Groups NameSupport on matter-test.zap) and suggests setEndpointDefaults does not always supply a valid default for bitmap/enum types.\n\n\`\`\`json\n${JSON.stringify(attrDefaultBugs.slice(0, 4), null, 2)}\n\`\`\``
    )
  }

  if (n === 1) {
    lines.push('No potential bugs recorded.')
    lines.push('')
  }

  lines.push('## How to reproduce')
  lines.push('')
  lines.push('```bash')
  lines.push('node test/resource/fancy-apps/build-fancy-apps.js')
  lines.push('```')
  lines.push('')
  lines.push(
    'Outputs: `test/resource/fancy-apps/*.zap`, `generated/`, and this report.'
  )
  lines.push('')

  return lines.join('\n')
}

async function main() {
  env.setDevelopmentEnv()
  fs.mkdirSync(GEN_OUT, { recursive: true })

  const dbFile = env.sqliteTestFile('fancy-apps-build')
  const db = await dbApi.initDatabaseAndLoadSchema(
    dbFile,
    env.schemaFile(),
    env.zapVersion()
  )

  const zclCache = new Map()
  const genCache = new Map()
  async function loadZcl(p) {
    if (!zclCache.has(p)) {
      const ctx = await zclLoader.loadZcl(db, p)
      zclCache.set(p, ctx.packageId)
    }
    return zclCache.get(p)
  }
  async function loadGen(p) {
    if (!genCache.has(p)) {
      const ctx = await genEngine.loadTemplates(db, p)
      genCache.set(p, ctx.packageId)
    }
    return genCache.get(p)
  }

  const appResults = []

  for (const spec of APP_SPECS) {
    console.log(`\n=== Building ${spec.name} ===`)
    try {
      const zclPackageIds = []
      for (const z of asArray(spec.zcl)) zclPackageIds.push(await loadZcl(z))
      const templatePackageIds = []
      for (const g of asArray(spec.gen))
        templatePackageIds.push(await loadGen(g))

      const created = await createApp(
        db,
        spec,
        spec.protocol === 'multiprotocol' ? zclPackageIds : zclPackageIds[0],
        spec.protocol === 'multiprotocol'
          ? templatePackageIds
          : templatePackageIds
      )
      console.log(`  Exported: ${created.zapPath}`)
      console.log(`  Build issues: ${created.issues.length}`)

      const components = await checkComponents(db, created.sessionId)
      console.log(
        `  Components mapped: ${components.components.length}, unmapped rows: ${components.missingMapping.length}`
      )

      const generation = await generateApp(
        db,
        created.sessionId,
        created.templatePackageId,
        spec.name
      )
      console.log(
        `  Generation: ${generation.success ? 'OK' : 'FAILED'} (${generation.fileCount} files)`
      )

      const validation = await validateZapFile(spec, created.zapPath)
      if (validation.error)
        console.log(`  Validation error: ${validation.error}`)
      else {
        console.log(
          `  Validation: ${validation.summary?.errors} errors, ${validation.attributeIssueCount} attr issues`
        )
      }

      appResults.push({
        spec,
        zapPath: created.zapPath,
        buildIssues: created.issues,
        coverage: created.coverage,
        components,
        generation,
        validation
      })
    } catch (err) {
      console.error(`  FATAL: ${err.message}`)
      appResults.push({
        spec,
        zapPath: path.join(OUT_DIR, `${spec.name}.zap`),
        buildIssues: [{ type: 'fatal', endpoint: null, error: err.stack }],
        coverage: [],
        components: { components: [], missingMapping: [] },
        generation: { success: false, error: err.message, fileCount: 0 },
        validation: { error: err.message }
      })
    }
  }

  console.log('\n=== CLI validate ===')
  let cliValidateResults = []
  try {
    cliValidateResults = runCliValidate(appResults)
  } catch (err) {
    console.error(`CLI validate failed to run: ${err.message}`)
  }

  const report = buildReport(appResults, cliValidateResults)
  fs.writeFileSync(REPORT_PATH, report)
  console.log(`\nReport: ${REPORT_PATH}`)
  await dbApi.closeDatabase(db)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
