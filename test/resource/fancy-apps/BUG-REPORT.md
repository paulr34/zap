# Fancy Matter & Zigbee Apps — Bug Report

Generated: 2026-08-28T15:26:18.748Z

Exploratory run that created multi-endpoint Matter, Zigbee, and multi-protocol ZAP configurations from device types, enabled the clusters those types require (plus a few extra clusters on the hub light), then validated and generated. **No product-code fixes were applied.**

UC component install was checked via gen-template cluster→component mapping only. There is no Simplicity Studio session here, so components cannot actually be installed — missing mappings are reported as potential gaps.

## Apps Created

### matter-smart-home-hub (`matter-smart-home-hub.zap`)

- Protocol: **matter**
- Endpoints requested: 6
- Enabled endpoint-type clusters: 32
- UC component ids from mapping (0): (none)
- Clusters with **no UC component mapping**: 23 unique (32 endpoint-cluster rows)
  - Identify/server
  - Descriptor/server
  - Window Covering/server
  - Boolean State/server
  - Door Lock/server
  - Groups/server
  - Scenes/server
  - On/Off/server
  - … and 15 more
- Code generation: OK (102 files)
- In-process validation: 50 errors, 38 attribute findings, 0 endpoint findings, 4 conformance buckets

### matter-rainbow-light (`matter-rainbow-light.zap`)

- Protocol: **matter**
- Endpoints requested: 1
- Enabled endpoint-type clusters: 7
- UC component ids from mapping (0): (none)
- Clusters with **no UC component mapping**: 7 unique (7 endpoint-cluster rows)
  - Identify/server
  - Groups/server
  - Scenes/server
  - On/Off/server
  - Level Control/server
  - Descriptor/server
  - Color Control/server
- Code generation: OK (86 files)
- In-process validation: 32 errors, 25 attribute findings, 0 endpoint findings, 1 conformance buckets

### matter-kitchen-suite (`matter-kitchen-suite.zap`)

- Protocol: **matter**
- Endpoints requested: 4
- **Locked device-type clusters not enabled:** 1
  - ep 2 MA-temperature-controlled-cabinet: Temperature Control (server)
- Enabled endpoint-type clusters: 18
- UC component ids from mapping (0): (none)
- Clusters with **no UC component mapping**: 15 unique (18 endpoint-cluster rows)
  - Descriptor/server
  - Identify/server
  - Groups/server
  - Fan Control/server
  - Access Control/server
  - Basic Information/server
  - Localization Configuration/server
  - Time Format Localization/server
  - … and 7 more
- Code generation: OK (94 files)
- In-process validation: 7 errors, 6 attribute findings, 0 endpoint findings, 1 conformance buckets

### matter-composed-simple-types (`matter-composed-simple-types.zap`)

- Protocol: **matter**
- Note: Intentionally combines two Simple-class device types on one endpoint
- Endpoints requested: 1
- **Issues while creating the app:**
  - `insert_endpoint_type_failed` endpoint 1: "SQLITE_CONSTRAINT: Simple endpoint cannot have more than one application device type"
- Enabled endpoint-type clusters: 0
- UC component ids from mapping (0): (none)
- Code generation: OK (79 files)
- In-process validation: 0 errors, 0 attribute findings, 0 endpoint findings, 0 conformance buckets

### matter-sensor-array (`matter-sensor-array.zap`)

- Protocol: **matter**
- Endpoints requested: 7
- Enabled endpoint-type clusters: 30
- UC component ids from mapping (0): (none)
- Clusters with **no UC component mapping**: 19 unique (30 endpoint-cluster rows)
  - Identify/server
  - Descriptor/server
  - Flow Measurement/server
  - Relative Humidity Measurement/server
  - Illuminance Measurement/server
  - Occupancy Sensing/server
  - Pressure Measurement/server
  - Access Control/server
  - … and 11 more
- Code generation: OK (98 files)
- In-process validation: 19 errors, 19 attribute findings, 0 endpoint findings, 0 conformance buckets

### matter-bridge-composition (`matter-bridge-composition.zap`)

- Protocol: **matter**
- Endpoints requested: 4
- **Locked device-type clusters not enabled:** 1
  - ep 2 MA-bridgeddevice: Bridged Device Basic (server)
- Enabled endpoint-type clusters: 19
- UC component ids from mapping (0): (none)
- Clusters with **no UC component mapping**: 16 unique (19 endpoint-cluster rows)
  - Descriptor/server
  - Identify/server
  - Groups/server
  - Scenes/server
  - On/Off/server
  - Access Control/server
  - Basic Information/server
  - Localization Configuration/server
  - … and 8 more
- Code generation: OK (95 files)
- In-process validation: 12 errors, 7 attribute findings, 0 endpoint findings, 2 conformance buckets

### zigbee-smart-home (`zigbee-smart-home.zap`)

- Protocol: **zigbee**
- Endpoints requested: 5
- Enabled endpoint-type clusters: 27
- UC component ids from mapping (0): (none)
- Clusters with **no UC component mapping**: 12 unique (27 endpoint-cluster rows)
  - Basic/server
  - Identify/server
  - Groups/server
  - Scenes/server
  - On/off/server
  - Level Control/server
  - Color Control/server
  - Identify/client
  - … and 4 more
- Code generation: OK (13 files)
- In-process validation: 15 errors, 15 attribute findings, 0 endpoint findings, 0 conformance buckets

### zigbee-zll-showroom (`zigbee-zll-showroom.zap`)

- Protocol: **zigbee**
- Endpoints requested: 4
- Enabled endpoint-type clusters: 36
- UC component ids from mapping (0): (none)
- Clusters with **no UC component mapping**: 15 unique (36 endpoint-cluster rows)
  - Basic/server
  - Identify/client
  - Groups/client
  - Scenes/client
  - On/off/client
  - Level Control/client
  - Color Control/client
  - ZLL Commissioning/client
  - … and 7 more
- Code generation: OK (13 files)
- In-process validation: 46 errors, 46 attribute findings, 0 endpoint findings, 0 conformance buckets

### zigbee-energy-hub (`zigbee-energy-hub.zap`)

- Protocol: **zigbee**
- Endpoints requested: 4
- Enabled endpoint-type clusters: 19
- UC component ids from mapping (0): (none)
- Clusters with **no UC component mapping**: 10 unique (19 endpoint-cluster rows)
  - Basic/server
  - Identify/client
  - Identify/server
  - Groups/client
  - Scenes/client
  - Time/server
  - Door Lock/client
  - Groups/server
  - … and 2 more
- Code generation: OK (13 files)
- In-process validation: 2 errors, 2 attribute findings, 0 endpoint findings, 0 conformance buckets

### multiprotocol-bridge (`multiprotocol-bridge.zap`)

- Protocol: **multiprotocol**
- Endpoints requested: 3
- **Issues while creating the app:**
  - `fatal` endpoint null: "TypeError: Cannot read properties of undefined (reading 'sessionPartitionId')\n at Object.ensurePackagesAndPopulateSessionOptions (/workspace/src-electron/util/util.js:226:57)\n at async createSessionForSpec (/workspace/test/resource/fancy-apps/build-fancy-apps.js:258:3)\n at async createApp (/workspace/test/resource/fancy-apps/build-fancy-apps.js:342:21)\n at async main (/workspace/test/resource/fancy-apps/build-fancy-apps.js:895:23)"
- Enabled endpoint-type clusters: 0
- UC component ids from mapping (0): (none)
- Code generation: **FAILED** (0 files)
  - Error: `Cannot read properties of undefined (reading 'sessionPartitionId')`
- In-process validation error: Cannot read properties of undefined (reading 'sessionPartitionId')

## CLI `zap validate` Results

- **matter-smart-home-hub**: exit 1, 50 errors, 0 warnings
- **matter-rainbow-light**: exit 1, 32 errors, 0 warnings
- **matter-kitchen-suite**: exit 1, 7 errors, 0 warnings
- **matter-composed-simple-types**: exit 0, 0 errors, 0 warnings
- **matter-sensor-array**: exit 1, 19 errors, 0 warnings
- **matter-bridge-composition**: exit 1, 12 errors, 0 warnings
- **zigbee-smart-home**: exit 1, 15 errors, 0 warnings
- **zigbee-zll-showroom**: exit 1, 46 errors, 0 warnings
- **zigbee-energy-hub**: exit 1, 2 errors, 0 warnings

## Potential Bugs

### Bug 1: Validation errors on newly created app — matter-smart-home-hub

In-process `validateAll` reported 50 errors. Samples:

Attributes:

```json
[
  {
    "cluster": "Door Lock",
    "attribute": "LockType",
    "issues": ["Out of range"],
    "defaultValue": ""
  },
  {
    "cluster": "Door Lock",
    "attribute": "ActuatorEnabled",
    "issues": ["Out of range"],
    "defaultValue": ""
  },
  {
    "cluster": "Door Lock",
    "attribute": "DoorState",
    "issues": ["Out of range"],
    "defaultValue": ""
  },
  {
    "cluster": "Door Lock",
    "attribute": "OperatingMode",
    "issues": ["Out of range"],
    "defaultValue": ""
  },
  {
    "cluster": "Groups",
    "attribute": "NameSupport",
    "issues": ["Out of range"],
    "defaultValue": ""
  }
]
```

Endpoints:

```json
[]
```

### Bug 2: Validation errors on newly created app — matter-rainbow-light

In-process `validateAll` reported 32 errors. Samples:

Attributes:

```json
[
  {
    "cluster": "Groups",
    "attribute": "NameSupport",
    "issues": ["Out of range"],
    "defaultValue": ""
  },
  {
    "cluster": "On/Off",
    "attribute": "StartUpOnOff",
    "issues": ["Out of range"],
    "defaultValue": ""
  },
  {
    "cluster": "Color Control",
    "attribute": "NumberOfPrimaries",
    "issues": ["Out of range"],
    "defaultValue": ""
  },
  {
    "cluster": "Color Control",
    "attribute": "Primary1X",
    "issues": ["Out of range"],
    "defaultValue": ""
  },
  {
    "cluster": "Color Control",
    "attribute": "Primary1Y",
    "issues": ["Out of range"],
    "defaultValue": ""
  }
]
```

Endpoints:

```json
[]
```

### Bug 3: Device-type locked clusters not auto-enabled — matter-kitchen-suite

After `insertEndpointType` / `setEndpointDefaults`, these locked includeClient/includeServer clusters were not enabled:

```json
[
  {
    "endpoint": 2,
    "deviceType": "MA-temperature-controlled-cabinet",
    "cluster": "Temperature Control",
    "side": "server"
  }
]
```

### Bug 4: Validation errors on newly created app — matter-kitchen-suite

In-process `validateAll` reported 7 errors. Samples:

Attributes:

```json
[
  {
    "cluster": "Groups",
    "attribute": "NameSupport",
    "issues": ["Out of range"],
    "defaultValue": ""
  },
  {
    "cluster": "Time Format Localization",
    "attribute": "HourFormat",
    "issues": ["Out of range"],
    "defaultValue": ""
  },
  {
    "cluster": "Network Commissioning",
    "attribute": "MaxNetworks",
    "issues": ["Out of range"],
    "defaultValue": ""
  },
  {
    "cluster": "Network Commissioning",
    "attribute": "InterfaceEnabled",
    "issues": ["Out of range"],
    "defaultValue": ""
  },
  {
    "cluster": "Network Commissioning",
    "attribute": "LastNetworkingStatus",
    "issues": ["Out of range"],
    "defaultValue": ""
  }
]
```

Endpoints:

```json
[]
```

### Bug 5: insertEndpointType failed — matter-composed-simple-types

Creating endpoint 1 with device types `MA-refrigerator, MA-temperature-controlled-cabinet` threw:

```
SQLITE_CONSTRAINT: Simple endpoint cannot have more than one application device type
```

This may be expected for Simple-class Matter composition (two application device types on one simple endpoint), or it may be an overly strict trigger.

### Bug 6: Validation errors on newly created app — matter-sensor-array

In-process `validateAll` reported 19 errors. Samples:

Attributes:

```json
[
  {
    "cluster": "Flow Measurement",
    "attribute": "MeasuredValue",
    "issues": ["Out of range"],
    "defaultValue": ""
  },
  {
    "cluster": "Flow Measurement",
    "attribute": "MinMeasuredValue",
    "issues": ["Out of range"],
    "defaultValue": ""
  },
  {
    "cluster": "Flow Measurement",
    "attribute": "MaxMeasuredValue",
    "issues": ["Out of range"],
    "defaultValue": ""
  },
  {
    "cluster": "Relative Humidity Measurement",
    "attribute": "MeasuredValue",
    "issues": ["Out of range"],
    "defaultValue": ""
  },
  {
    "cluster": "Relative Humidity Measurement",
    "attribute": "MinMeasuredValue",
    "issues": ["Out of range"],
    "defaultValue": ""
  }
]
```

Endpoints:

```json
[]
```

### Bug 7: Device-type locked clusters not auto-enabled — matter-bridge-composition

After `insertEndpointType` / `setEndpointDefaults`, these locked includeClient/includeServer clusters were not enabled:

```json
[
  {
    "endpoint": 2,
    "deviceType": "MA-bridgeddevice",
    "cluster": "Bridged Device Basic",
    "side": "server"
  }
]
```

### Bug 8: Validation errors on newly created app — matter-bridge-composition

In-process `validateAll` reported 12 errors. Samples:

Attributes:

```json
[
  {
    "cluster": "Groups",
    "attribute": "NameSupport",
    "issues": ["Out of range"],
    "defaultValue": ""
  },
  {
    "cluster": "On/Off",
    "attribute": "StartUpOnOff",
    "issues": ["Out of range"],
    "defaultValue": ""
  },
  {
    "cluster": "Time Format Localization",
    "attribute": "HourFormat",
    "issues": ["Out of range"],
    "defaultValue": ""
  },
  {
    "cluster": "Network Commissioning",
    "attribute": "MaxNetworks",
    "issues": ["Out of range"],
    "defaultValue": ""
  },
  {
    "cluster": "Network Commissioning",
    "attribute": "InterfaceEnabled",
    "issues": ["Out of range"],
    "defaultValue": ""
  }
]
```

Endpoints:

```json
[]
```

### Bug 9: Validation errors on newly created app — zigbee-smart-home

In-process `validateAll` reported 15 errors. Samples:

Attributes:

```json
[
  {
    "cluster": "Groups",
    "attribute": "name support",
    "issues": ["Out of range"],
    "defaultValue": ""
  },
  {
    "cluster": "Scenes",
    "attribute": "name support",
    "issues": ["Out of range"],
    "defaultValue": ""
  },
  {
    "cluster": "Color Control",
    "attribute": "couple color temp to level min-mireds",
    "issues": ["Out of range"],
    "defaultValue": ""
  },
  {
    "cluster": "Color Control",
    "attribute": "start up color temperature mireds",
    "issues": ["Out of range"],
    "defaultValue": ""
  },
  {
    "cluster": "Groups",
    "attribute": "name support",
    "issues": ["Out of range"],
    "defaultValue": ""
  }
]
```

Endpoints:

```json
[]
```

### Bug 10: Zigbee cluster→UC component mapping gaps — zigbee-smart-home

zigbee2 gen-templates declare `autoEnableComponents` and `cluster-to-component-dependencies.json`, but these enabled clusters have no mapping (Studio would not auto-install a component):

- Basic/server
- Identify/server
- Groups/server
- Scenes/server
- On/off/server
- Level Control/server
- Color Control/server
- Identify/client
- Door Lock/server
- Occupancy Sensing/server
- Window Covering/server
- Thermostat/server

### Bug 11: Validation errors on newly created app — zigbee-zll-showroom

In-process `validateAll` reported 46 errors. Samples:

Attributes:

```json
[
  {
    "cluster": "Groups",
    "attribute": "name support",
    "issues": ["Out of range"],
    "defaultValue": ""
  },
  {
    "cluster": "Scenes",
    "attribute": "name support",
    "issues": ["Out of range"],
    "defaultValue": ""
  },
  {
    "cluster": "Color Control",
    "attribute": "number of primaries",
    "issues": ["Out of range"],
    "defaultValue": ""
  },
  {
    "cluster": "Color Control",
    "attribute": "primary 1 x",
    "issues": ["Out of range"],
    "defaultValue": ""
  },
  {
    "cluster": "Color Control",
    "attribute": "primary 1 y",
    "issues": ["Out of range"],
    "defaultValue": ""
  }
]
```

Endpoints:

```json
[]
```

### Bug 12: Zigbee cluster→UC component mapping gaps — zigbee-zll-showroom

zigbee2 gen-templates declare `autoEnableComponents` and `cluster-to-component-dependencies.json`, but these enabled clusters have no mapping (Studio would not auto-install a component):

- Basic/server
- Identify/client
- Groups/client
- Scenes/client
- On/off/client
- Level Control/client
- Color Control/client
- ZLL Commissioning/client
- ZLL Commissioning/server
- Identify/server
- Groups/server
- Scenes/server
- On/off/server
- Level Control/server
- Color Control/server

### Bug 13: Validation errors on newly created app — zigbee-energy-hub

In-process `validateAll` reported 2 errors. Samples:

Attributes:

```json
[
  {
    "cluster": "Groups",
    "attribute": "name support",
    "issues": ["Out of range"],
    "defaultValue": ""
  },
  {
    "cluster": "Scenes",
    "attribute": "name support",
    "issues": ["Out of range"],
    "defaultValue": ""
  }
]
```

Endpoints:

```json
[]
```

### Bug 14: Zigbee cluster→UC component mapping gaps — zigbee-energy-hub

zigbee2 gen-templates declare `autoEnableComponents` and `cluster-to-component-dependencies.json`, but these enabled clusters have no mapping (Studio would not auto-install a component):

- Basic/server
- Identify/client
- Identify/server
- Groups/client
- Scenes/client
- Time/server
- Door Lock/client
- Groups/server
- Scenes/server
- On/off/server

### Bug 15: Code generation failed — multiprotocol-bridge

`generateAndWriteFiles` failed: Cannot read properties of undefined (reading 'sessionPartitionId')

### Bug 16: CLI validate non-zero exit — matter-smart-home-hub

`zap validate` exit 1: 50 errors, 0 warnings. This is a freshly created file from device-type defaults, so errors here are likely default-value or endpoint-id issues rather than user misconfiguration.

### Bug 17: CLI validate non-zero exit — matter-rainbow-light

`zap validate` exit 1: 32 errors, 0 warnings. This is a freshly created file from device-type defaults, so errors here are likely default-value or endpoint-id issues rather than user misconfiguration.

### Bug 18: CLI validate non-zero exit — matter-kitchen-suite

`zap validate` exit 1: 7 errors, 0 warnings. This is a freshly created file from device-type defaults, so errors here are likely default-value or endpoint-id issues rather than user misconfiguration.

### Bug 19: CLI validate non-zero exit — matter-sensor-array

`zap validate` exit 1: 19 errors, 0 warnings. This is a freshly created file from device-type defaults, so errors here are likely default-value or endpoint-id issues rather than user misconfiguration.

### Bug 20: CLI validate non-zero exit — matter-bridge-composition

`zap validate` exit 1: 12 errors, 0 warnings. This is a freshly created file from device-type defaults, so errors here are likely default-value or endpoint-id issues rather than user misconfiguration.

### Bug 21: CLI validate non-zero exit — zigbee-smart-home

`zap validate` exit 1: 15 errors, 0 warnings. This is a freshly created file from device-type defaults, so errors here are likely default-value or endpoint-id issues rather than user misconfiguration.

### Bug 22: CLI validate non-zero exit — zigbee-zll-showroom

`zap validate` exit 1: 46 errors, 0 warnings. This is a freshly created file from device-type defaults, so errors here are likely default-value or endpoint-id issues rather than user misconfiguration.

### Bug 23: CLI validate non-zero exit — zigbee-energy-hub

`zap validate` exit 1: 2 errors, 0 warnings. This is a freshly created file from device-type defaults, so errors here are likely default-value or endpoint-id issues rather than user misconfiguration.

### Bug 24: Device-type defaults leave attributes out of range or empty

Several newly created apps enable mandatory attributes whose default is empty or out of range. That matches existing fixtures (e.g. Groups NameSupport on matter-test.zap) and suggests setEndpointDefaults does not always supply a valid default for bitmap/enum types.

```json
[
  {
    "app": "matter-smart-home-hub",
    "samples": [
      {
        "cluster": "Door Lock",
        "attribute": "LockType",
        "issues": ["Out of range"],
        "defaultValue": ""
      },
      {
        "cluster": "Door Lock",
        "attribute": "ActuatorEnabled",
        "issues": ["Out of range"],
        "defaultValue": ""
      },
      {
        "cluster": "Door Lock",
        "attribute": "DoorState",
        "issues": ["Out of range"],
        "defaultValue": ""
      },
      {
        "cluster": "Door Lock",
        "attribute": "OperatingMode",
        "issues": ["Out of range"],
        "defaultValue": ""
      },
      {
        "cluster": "Groups",
        "attribute": "NameSupport",
        "issues": ["Out of range"],
        "defaultValue": ""
      }
    ]
  },
  {
    "app": "matter-rainbow-light",
    "samples": [
      {
        "cluster": "Groups",
        "attribute": "NameSupport",
        "issues": ["Out of range"],
        "defaultValue": ""
      },
      {
        "cluster": "On/Off",
        "attribute": "StartUpOnOff",
        "issues": ["Out of range"],
        "defaultValue": ""
      },
      {
        "cluster": "Color Control",
        "attribute": "NumberOfPrimaries",
        "issues": ["Out of range"],
        "defaultValue": ""
      },
      {
        "cluster": "Color Control",
        "attribute": "Primary1X",
        "issues": ["Out of range"],
        "defaultValue": ""
      },
      {
        "cluster": "Color Control",
        "attribute": "Primary1Y",
        "issues": ["Out of range"],
        "defaultValue": ""
      }
    ]
  },
  {
    "app": "matter-kitchen-suite",
    "samples": [
      {
        "cluster": "Groups",
        "attribute": "NameSupport",
        "issues": ["Out of range"],
        "defaultValue": ""
      },
      {
        "cluster": "Time Format Localization",
        "attribute": "HourFormat",
        "issues": ["Out of range"],
        "defaultValue": ""
      },
      {
        "cluster": "Network Commissioning",
        "attribute": "MaxNetworks",
        "issues": ["Out of range"],
        "defaultValue": ""
      },
      {
        "cluster": "Network Commissioning",
        "attribute": "InterfaceEnabled",
        "issues": ["Out of range"],
        "defaultValue": ""
      },
      {
        "cluster": "Network Commissioning",
        "attribute": "LastNetworkingStatus",
        "issues": ["Out of range"],
        "defaultValue": ""
      }
    ]
  },
  {
    "app": "matter-sensor-array",
    "samples": [
      {
        "cluster": "Flow Measurement",
        "attribute": "MeasuredValue",
        "issues": ["Out of range"],
        "defaultValue": ""
      },
      {
        "cluster": "Flow Measurement",
        "attribute": "MinMeasuredValue",
        "issues": ["Out of range"],
        "defaultValue": ""
      },
      {
        "cluster": "Flow Measurement",
        "attribute": "MaxMeasuredValue",
        "issues": ["Out of range"],
        "defaultValue": ""
      },
      {
        "cluster": "Relative Humidity Measurement",
        "attribute": "MeasuredValue",
        "issues": ["Out of range"],
        "defaultValue": ""
      },
      {
        "cluster": "Relative Humidity Measurement",
        "attribute": "MinMeasuredValue",
        "issues": ["Out of range"],
        "defaultValue": ""
      }
    ]
  }
]
```

### Bug 25: `ensurePackagesAndPopulateSessionOptions` crashes for two gen templates

Creating `multiprotocol-bridge` logged that both ZCL packages and both gen templates were selected, then threw:

```
TypeError: Cannot read properties of undefined (reading 'sessionPartitionId')
    at ensurePackagesAndPopulateSessionOptions (src-electron/util/util.js:226:57)
```

What the code does:

1. The ZCL branch increments `sessionPartitionIndex` once per ZCL package (ends at 2 for Matter+Zigbee).
2. The gen-template branch then uses `sessionPartitionInfo[sessionPartitionIndex]` without creating more partitions. With `partitions: 2`, index 2 does not exist.
3. Gen templates are therefore attached to partitions _after_ the ZCL ones, not to the same protocol partitions. Even with more partitions that would pair templates with the wrong ZCL package.
4. `insertSessionPackage` is called with `selectedGenTemplatePackages[i]` (a `{ id }` object). The ZCL loop passes `.id`. That looks like a second defect on the same path.

No `.zap` was produced for the multi-protocol app.

### Bug 26: ZCL XML defaults fail validation at load time

While loading builtin Matter and Zigbee XML, ZAP logged many metadata issues (not app-config errors), including:

- Signed attributes with unsigned-looking sentinels (`int16s` default `0xffff` / `0x8000` → “Out of range”)
- `boolean` defaults of `0x00` → “Invalid boolean value. Must be true, false, 0, or 1”
- Thermostat `AbsMinHeatSetpointLimit` default `700` vs parsed min `38221`
- `OTAUpdateStateEnum` default `Unknown` → “Invalid Integer”
- Type contradictions (`BITMAP8`, `INT24U`, `INT8U` names)

These fire for every session that loads the builtin packages. Empty app-level defaults (Bug 24) may be downstream of the same XML.

### Bug 27: UC component mapping returned no ids (including zigbee2)

Matter test templates do not define cluster→component defaults, so zero UC ids there is expected.

`test/gen-template/zigbee2/gen-templates.json` does set `autoEnableComponents` and `cluster-to-component-dependencies.json` (`basic-server` → `zigbee_basic`, `on/off-server` → `zigbee_on_off`, …). `getComponentIdsByCluster` still returned **no component ids** for all three Zigbee apps after device-type clusters were enabled. Studio auto-install would not run for those clusters.

Possible causes (not confirmed): extension default lookup, cluster name vs `clusterCode` key, or session package selection when several gen-template packages are loaded in one process DB.

## How to reproduce

```bash
node test/resource/fancy-apps/build-fancy-apps.js
```

Outputs: `test/resource/fancy-apps/*.zap`, `generated/`, and this report.
