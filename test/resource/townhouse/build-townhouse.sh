#!/usr/bin/env bash
# Build the townhouse Matter fabric .zap from the story.
# Usage: from repo root
#   ./test/resource/townhouse/build-townhouse.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

MATTER=(--zcl ./zcl-builtin/matter/zcl.json --gen ./test/gen-template/matter/gen-test.json)
XML="$ROOT/test/resource/townhouse/townhouse-energy-devices.xml"
OUT="$ROOT/test/resource/townhouse/townhouse.zap"
EDIT=(npm run zap-edit --)

edit() {
  echo "▸ $*"
  "${EDIT[@]}" "$@" "${MATTER[@]}" --quiet --noZapFileLog --tempState
}

# Enable a server cluster; ignore if already enabled / not applicable.
enable_server() {
  local ep="$1" cluster="$2"
  edit cluster enable "$OUT" --endpoint "$ep" --cluster "$cluster" --side server || true
}

rm -f "$OUT" "${OUT}~"
edit new "$OUT" --force
edit package add "$OUT" --xml "$XML"

# EP1 — Energy Gateway (aggregator + energy management utility type)
edit endpoint create "$OUT" --endpoint 1 \
  --device-type MA-aggregator --device-type MA-deviceenergymanagement

# EP2 — EVSE, child of gateway; EP3 — electrical sensor under the EVSE
edit endpoint create "$OUT" --endpoint 2 --device-type MA-evse --parent 1
edit endpoint create "$OUT" --endpoint 3 --device-type MA-electricalsensor --parent 2

# EP4 — Heat pump / room AC; EP5/EP8 — zone thermostats
edit endpoint create "$OUT" --endpoint 4 --device-type MA-roomac --parent 1
edit endpoint create "$OUT" --endpoint 5 --device-type MA-thermostat --parent 4
edit endpoint create "$OUT" --endpoint 8 --device-type MA-thermostat --parent 4

# Per-zone occupancy + dimmable light (downstairs = 5, upstairs = 8)
edit endpoint create "$OUT" --endpoint 6 --device-type MA-occupancysensor --parent 5
edit endpoint create "$OUT" --endpoint 7 --device-type MA-dimmablelight --parent 5
edit endpoint create "$OUT" --endpoint 9 --device-type MA-occupancysensor --parent 8
edit endpoint create "$OUT" --endpoint 10 --device-type MA-dimmablelight --parent 8

# Garage: door lock + contact sensor
edit endpoint create "$OUT" --endpoint 11 --device-type MA-doorlock --parent 1
edit endpoint create "$OUT" --endpoint 12 --device-type MA-contactsensor --parent 11

# Water heater + laundry washer
edit endpoint create "$OUT" --endpoint 13 --device-type MA-waterheater --parent 1
edit endpoint create "$OUT" --endpoint 14 --device-type MA-laundrywasher --parent 1

# Bridge endpoint for legacy Zigbee TRVs (composition hook; Zigbee half is
# in townhouse-multiprotocol.zap)
edit endpoint create "$OUT" --endpoint 15 --device-type MA-controlbridge --parent 1

# Ensure required clusters on custom energy device types (device-type create
# sometimes misses clusters that live in the base Matter package).
for ep in 1 2 3; do
  enable_server "$ep" "Electrical Measurement"
done
for ep in 2 4 13 14; do
  enable_server "$ep" Identify
done
for ep in 2 13 14; do
  enable_server "$ep" "Mode Select"
done
enable_server 2 Descriptor
enable_server 2 "Power Source"
enable_server 3 Descriptor
enable_server 3 "Power Source"
enable_server 4 "On/Off"
enable_server 4 Thermostat
enable_server 4 "Fan Control"
enable_server 4 "Temperature Measurement"
enable_server 4 "Electrical Measurement"
enable_server 13 "On/Off"
enable_server 13 Thermostat
enable_server 13 "Temperature Measurement"
enable_server 13 "Electrical Measurement"
enable_server 14 "On/Off"
enable_server 14 "Electrical Measurement"

# Story-relevant attribute defaults on path lights (night level)
edit attribute set "$OUT" --endpoint 7 --cluster "Level Control" \
  --attribute CurrentLevel --enabled --default 25
edit attribute set "$OUT" --endpoint 10 --cluster "Level Control" \
  --attribute CurrentLevel --enabled --default 25
edit feature enable "$OUT" --endpoint 7 --cluster On/Off --feature LT || true
edit feature enable "$OUT" --endpoint 10 --cluster On/Off --feature LT || true

edit endpoint list "$OUT"
echo "Built $OUT"
