# Townhouse Matter fabric (ZAP story)

> It’s not a light demo — it’s a house that negotiates power and comfort between the car, the heat pump, and who’s actually in the room.

One Matter fabric for a multifamily townhouse: peak electricity shedding, comfort by zone occupancy, and a fallback path when HVAC is in maintenance. Devices don’t just exist on the network — they negotiate who needs power, who can shed load, who’s home, and how hot each room is.

## Files

| File                               | Role                                                                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `townhouse.zap`                    | Matter-only composition (16 endpoints)                                                                                |
| `townhouse-multiprotocol.zap`      | Same Matter tree + bridged Zigbee TRVs (endpoints 20/21)                                                              |
| `townhouse-energy-devices.xml`     | Custom Matter device types (EVSE, electrical sensor, water heater, laundry washer, room AC, device energy management) |
| `build-townhouse.sh`               | Rebuilds `townhouse.zap`                                                                                              |
| `build-townhouse-multiprotocol.sh` | Rebuilds `townhouse-multiprotocol.zap` from `multi-protocol.zap`                                                      |

Rebuild from the repo root:

```bash
./test/resource/townhouse/build-townhouse.sh
./test/resource/townhouse/build-townhouse-multiprotocol.sh
```

## Endpoint map

```
EP0  MA-rootdevice
EP1  Energy Gateway — MA-aggregator + MA-deviceenergymanagement
├── EP2  MA-evse (EV charger)
│   └── EP3  MA-electricalsensor
├── EP4  MA-roomac (heat pump / room AC)
│   ├── EP5  downstairs MA-thermostat
│   │   ├── EP6  MA-occupancysensor
│   │   └── EP7  MA-dimmablelight          CurrentLevel=25 (night path)
│   └── EP8  upstairs MA-thermostat
│       ├── EP9  MA-occupancysensor
│       └── EP10 MA-dimmablelight         CurrentLevel=25
├── EP11 MA-doorlock (garage)
│   └── EP12 MA-contactsensor
├── EP13 MA-waterheater
├── EP14 MA-laundrywasher
└── EP15 MA-controlbridge                 (hook for legacy TRVs)

Multiprotocol only:
EP20 HA-tstat        Zigbee TRV / thermostat (secondary sensing)
EP21 HA-tempsensor   Zigbee temperature sensor
```

## The cast

1. **Energy Gateway (EP1)** — traffic cop on aggregator + energy management. Does not heat or cool; decides who may run hard from tariff windows and battery state.
2. **EVSE + electrical sensor (EP2/EP3)** — car plugs in; EVSE asks for power via Matter energy/power reporting clusters (Electrical Measurement, Mode Select).
3. **Heat pump / room AC + zones (EP4–EP10)** — parent HVAC with upstairs/downstairs thermostat children; occupancy + dimmable light composed under each zone.
4. **Garage lock + contact (EP11/EP12)** — late unlock → path lights to night level; garage close + EVSE session complete → deferred water-heater boost.
5. **Water heater (EP13)** — overnight boost when the energy picture allows it.
6. **Laundry washer (EP14)** — flexible “Eco delayed” start into a post-peak slot.
7. **Bridged Zigbee TRVs (EP15 + EP20/EP21)** — legacy valves report temperature; Matter zones use that as secondary sensing so the heat pump doesn’t overshoot.

## Movie scene

1. Plug in the car → EVSE requests power.
2. Gateway sees peak tariff + heat pump already heating the occupied downstairs zone → grants EVSE 3 kW, tells water heater “not now.”
3. Downstairs occupancy clears → zone relaxes setpoint → heat pump load drops.
4. Gateway raises EVSE to 7 kW and queues the washer for 11pm.
5. Garage unlocks late → path lights come up; zones stay in eco band so HVAC does not surge.

Cross-device coupling is application policy. ZAP models each node’s endpoints and clusters so SDK firmware can implement that policy.

## Notes

- Custom device IDs match the Matter spec (`0x050C` EVSE, `0x0510` electrical sensor, `0x050F` water heater, `0x0073` laundry washer, `0x0072` room AC, `0x050D` device energy management).
- Clusters are drawn from the shipped Matter `zcl.json` (Electrical Measurement, Mode Select, Thermostat, …). Full Energy EVSE / DEM cluster XML from newer data models is not required for this composition story.
- Multiprotocol build starts from `test/resource/multi-protocol.zap` because `zap edit new` with two `--zcl` / two `--gen` arguments currently persists only one of each.
- Multiprotocol uses `zcl-with-test-extensions.json` for Matter (same as `multi-protocol.zap`).
- Zigbee TRVs use endpoints 20/21: session-wide endpoint identifiers cannot collide across protocols in ZAP today.
- `HA-tstat` / `HA-tempsensor` also appear in the Matter silabs device catalog, so the multiprotocol listing may show those endpoints as belonging to both categories even though they were created with `--category zigbee`.
- Build scripts use `--tempState` so a stale shared `~/.zap` database cannot leave duplicate cluster rows in the saved file.
