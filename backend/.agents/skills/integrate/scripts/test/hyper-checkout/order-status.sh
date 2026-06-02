#!/usr/bin/env bash
# test-order-status.sh — Fetch order status from the backend
# Usage: ./test-order-status.sh ORDER_STATUS_ENDPOINT ORDER_ID

set -euo pipefail

ORDER_STATUS_ENDPOINT="${1:?ORDER_STATUS_ENDPOINT required (e.g. http://localhost:3001/api/juspay/order-status)}"
ORDER_ID="${2:?ORDER_ID required}"

ENDPOINT="${ORDER_STATUS_ENDPOINT}/${ORDER_ID}"
echo "→ GET ${ENDPOINT}"

HTTP_STATUS=$(curl -s -o /tmp/juspay_status_resp.json -w "%{http_code}" "${ENDPOINT}")

BODY=$(cat /tmp/juspay_status_resp.json)
echo "← HTTP ${HTTP_STATUS}"
if command -v jq &>/dev/null; then
  echo "${BODY}" | jq . 2>/dev/null || echo "${BODY}"
else
  echo "${BODY}" | python3 -m json.tool 2>/dev/null || echo "${BODY}"
fi

if [ "${HTTP_STATUS}" -eq 200 ]; then
  echo "✅ PASS — status received"
else
  echo "❌ FAIL — expected 200, got ${HTTP_STATUS}"
  exit 1
fi
