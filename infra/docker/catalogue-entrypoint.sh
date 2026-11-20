#!/bin/sh
set -eu
if [ -f /var/run/mokly-secrets/catalogue-signing-key ]; then
  MKC_CATALOGUE_SIGNING_KEY=$(cat /var/run/mokly-secrets/catalogue-signing-key)
  export MKC_CATALOGUE_SIGNING_KEY
fi
exec /usr/local/bin/mkc-catalogue-server "$@"
