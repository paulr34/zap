#!/usr/bin/env bash
# Matter townhouse fabric + bridged Zigbee radiator valves (TRVs).
#
# Dual-package `zap edit new` currently persists only one zcl + one gen
# package, so this script boots from test/resource/multi-protocol.zap which
# already carries Matter + Zigbee packages.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

# multi-protocol.zap uses the Matter package with test extensions; keep that
# so both halves stay linked the way the template expects.
PACKAGES=(
  --zcl ./zcl-builtin/silabs/zcl.json
  --zcl ./zcl-builtin/matter/zcl-with-test-extensions.json
  --gen ./test/gen-template/zigbee/gen-templates.json
  --gen ./test/gen-template/matter/gen-test.json
)
XML="$ROOT/test/resource/townhouse/townhouse-energy-devices.xml"
OUT="$ROOT/test/resource/townhouse/townhouse-multiprotocol.zap"
TEMPLATE="$ROOT/test/resource/multi-protocol.zap"
EDIT=(npm run zap-edit --)

edit() {
  echo "▸ $*"
  "${EDIT[@]}" "$@" "${PACKAGES[@]}" --quiet --noZapFileLog --tempState
}

rm -f "$OUT" "${OUT}~"
cp "$TEMPLATE" "$OUT"

# Clear the template endpoints (Matter EP1 child first, then both protocol EP1s, then root).
edit endpoint delete "$OUT" --endpoint 1 --category matter --force
edit endpoint delete "$OUT" --endpoint 1 --category zigbee --force
edit endpoint delete "$OUT" --endpoint 0 --category matter --force

# Root node for Matter
edit endpoint create "$OUT" --endpoint 0 --category matter --device-type MA-rootdevice

edit package add "$OUT" --xml "$XML"

# --- Matter half (same composition as townhouse.zap) ---
edit endpoint create "$OUT" --endpoint 1 --category matter \
  --device-type MA-aggregator --device-type MA-deviceenergymanagement
edit endpoint create "$OUT" --endpoint 2 --category matter --device-type MA-evse --parent 1
edit endpoint create "$OUT" --endpoint 3 --category matter --device-type MA-electricalsensor --parent 2
edit endpoint create "$OUT" --endpoint 4 --category matter --device-type MA-roomac --parent 1
edit endpoint create "$OUT" --endpoint 5 --category matter --device-type MA-thermostat --parent 4
edit endpoint create "$OUT" --endpoint 6 --category matter --device-type MA-occupancysensor --parent 5
edit endpoint create "$OUT" --endpoint 7 --category matter --device-type MA-dimmablelight --parent 5
edit endpoint create "$OUT" --endpoint 8 --category matter --device-type MA-thermostat --parent 4
edit endpoint create "$OUT" --endpoint 9 --category matter --device-type MA-occupancysensor --parent 8
edit endpoint create "$OUT" --endpoint 10 --category matter --device-type MA-dimmablelight --parent 8
edit endpoint create "$OUT" --endpoint 11 --category matter --device-type MA-doorlock --parent 1
edit endpoint create "$OUT" --endpoint 12 --category matter --device-type MA-contactsensor --parent 11
edit endpoint create "$OUT" --endpoint 13 --category matter --device-type MA-waterheater --parent 1
edit endpoint create "$OUT" --endpoint 14 --category matter --device-type MA-laundrywasher --parent 1
edit endpoint create "$OUT" --endpoint 15 --category matter --device-type MA-controlbridge --parent 1

# --- Zigbee TRVs (legacy radiator valves), secondary sensing for the zones ---
# Session-wide endpoint ids cannot collide across protocols in ZAP today, so
# the TRVs use 20/21 while Matter keeps 0–15. --category still selects which
# protocol’s packages resolve the device type at create time.
edit endpoint create "$OUT" --endpoint 20 --category zigbee \
  --device-type HA-tstat
edit endpoint create "$OUT" --endpoint 21 --category zigbee \
  --device-type HA-tempsensor

# Do not re-enable clusters here: on custom Matter device types a second
# enable can write a duplicate ENDPOINT_TYPE_CLUSTER that then fails to reload.

edit attribute set "$OUT" --endpoint 7 --category matter --cluster "Level Control" \
  --attribute CurrentLevel --enabled --default 25
edit attribute set "$OUT" --endpoint 10 --category matter --cluster "Level Control" \
  --attribute CurrentLevel --enabled --default 25

# HA-tstat / HA-tempsensor exist in both Matter and Zigbee catalogs; create can
# write the same device type twice. Keep one of each name/code in the file.
node -e '
const fs = require("fs");
const path = process.argv[1];
const z = JSON.parse(fs.readFileSync(path, "utf8"));
for (const t of z.endpointTypes || []) {
  if (t.deviceTypes) {
    const seen = new Set();
    t.deviceTypes = t.deviceTypes.filter((d) => {
      const key = d.name + "/" + d.code;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
fs.writeFileSync(path, JSON.stringify(z, null, 2) + "\n");
' "$OUT"

edit endpoint list "$OUT"
echo "Built $OUT"
