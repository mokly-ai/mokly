#!/bin/sh
set -eu
if [ -f /var/run/mokly-secrets/catalogue-signing-key ]; then
  MKC_CATALOGUE_SIGNING_KEY=$(cat /var/run/mokly-secrets/catalogue-signing-key)
  export MKC_CATALOGUE_SIGNING_KEY
fi
if [ -f /var/run/mokly-secrets/preview-sign-in ]; then
  MKC_PREVIEW_SIGN_IN_VERIFIER=$(cat /var/run/mokly-secrets/preview-sign-in)
  export MKC_PREVIEW_SIGN_IN_VERIFIER
fi
if [ -f /var/run/mokly-secrets/postmark-token ]; then
  POSTMARK_SERVER_TOKEN=$(cat /var/run/mokly-secrets/postmark-token)
  export POSTMARK_SERVER_TOKEN
fi
if [ -f /var/run/mokly-secrets/github-client-secret ]; then
  MKC_GITHUB_CLIENT_SECRET=$(cat /var/run/mokly-secrets/github-client-secret)
  export MKC_GITHUB_CLIENT_SECRET
fi
if [ -f /var/run/mokly-secrets/github-app-key ]; then
  MKC_GITHUB_PRIVATE_KEY=$(cat /var/run/mokly-secrets/github-app-key)
  export MKC_GITHUB_PRIVATE_KEY
fi
if [ -f /var/run/mokly-secrets/github-webhook-secret ]; then
  MKC_GITHUB_WEBHOOK_SECRET=$(cat /var/run/mokly-secrets/github-webhook-secret)
  export MKC_GITHUB_WEBHOOK_SECRET
fi
if [ -f /var/run/mokly-secrets/e2b-api-key ]; then
  MKC_E2B_API_KEY=$(cat /var/run/mokly-secrets/e2b-api-key)
  export MKC_E2B_API_KEY
fi
if [ -f /var/run/mokly-secrets/stripe-secret-key ]; then
  MKC_STRIPE_SECRET_KEY=$(cat /var/run/mokly-secrets/stripe-secret-key)
  export MKC_STRIPE_SECRET_KEY
fi
if [ -f /var/run/mokly-secrets/stripe-webhook-secret ]; then
  MKC_STRIPE_WEBHOOK_SECRET=$(cat /var/run/mokly-secrets/stripe-webhook-secret)
  export MKC_STRIPE_WEBHOOK_SECRET
fi
exec /usr/local/bin/mkc-api "$@"
