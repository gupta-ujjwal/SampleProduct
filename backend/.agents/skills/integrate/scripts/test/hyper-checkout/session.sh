#!/usr/bin/env bash
# test-session.sh — Create a Juspay payment session via the backend
# Usage: ./test-session.sh SESSION_ENDPOINT ORDER_ID AMOUNT CUSTOMER_ID CUSTOMER_EMAIL CUSTOMER_PHONE FIRST_NAME LAST_NAME

set -euo pipefail

SESSION_ENDPOINT="${1:?SESSION_ENDPOINT required (e.g. http://localhost:3001/api/juspay/session)}"
ORDER_ID="${2:?ORDER_ID required}"
AMOUNT="${3:?AMOUNT required (e.g. 1.00)}"
CUSTOMER_ID="${4:?CUSTOMER_ID required}"
CUSTOMER_EMAIL="${5:?CUSTOMER_EMAIL required}"
CUSTOMER_PHONE="${6:?CUSTOMER_PHONE required}"
FIRST_NAME="${7:?FIRST_NAME required}"
LAST_NAME="${8:?LAST_NAME required}"

echo "→ POST ${SESSION_ENDPOINT}"

HTTP_STATUS=$(curl -s -o /tmp/juspay_session_resp.json -w "%{http_code}" -X POST "${SESSION_ENDPOINT}" \
  -H "Content-Type: application/json" \
  -d "{
    \"order_id\": \"${ORDER_ID}\",
    \"amount\": \"${AMOUNT}\",
    \"customer_id\": \"${CUSTOMER_ID}\",
    \"customer_email\": \"${CUSTOMER_EMAIL}\",
    \"customer_phone\": \"${CUSTOMER_PHONE}\",
    \"first_name\": \"${FIRST_NAME}\",
    \"last_name\": \"${LAST_NAME}\"
  }")

BODY=$(cat /tmp/juspay_session_resp.json)
echo "← HTTP ${HTTP_STATUS}"
if command -v jq &>/dev/null; then
  echo "${BODY}" | jq . 2>/dev/null || echo "${BODY}"
else
  echo "${BODY}" | python3 -m json.tool 2>/dev/null || echo "${BODY}"
fi

if [ "${HTTP_STATUS}" -eq 200 ]; then
  echo "✅ PASS — session created"
else
  echo "❌ FAIL — expected 200, got ${HTTP_STATUS}"
  exit 1
fi
