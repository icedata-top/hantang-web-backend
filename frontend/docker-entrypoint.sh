#!/bin/sh
set -eu

api_base_url=$(printf '%s' "${ICEDATA_API_BASE_URL:-/api}" | sed 's/\\/\\\\/g; s/"/\\"/g')
admin_enabled=false
if [ "${ICEDATA_ADMIN_ENABLED:-false}" = "true" ]; then
  admin_enabled=true
fi

cat > /srv/runtime-config.js <<EOF
window.__ICEDATA_RUNTIME_CONFIG__ = {
  apiBaseUrl: "${api_base_url}",
  adminEnabled: ${admin_enabled}
};
EOF

exec "$@"
