#!/bin/sh
set -eu
secrets_dir=${MKC_SECRETS_DIR:-/var/run/mokly-secrets}
if [ -f "$secrets_dir/catalogue-signing-key" ]; then
  MKC_CATALOGUE_SIGNING_KEY=$(cat "$secrets_dir/catalogue-signing-key")
  export MKC_CATALOGUE_SIGNING_KEY
fi
verifier_file="$secrets_dir/preview-sign-in"
if [ -f "$verifier_file" ]; then
  verifier=$(cat "$verifier_file")
  case "$verifier" in
    '$scrypt$'*) export MKC_PREVIEW_SIGN_IN_VERIFIER="$verifier" ;;
    *)
      unset MKC_PREVIEW_SIGN_IN_VERIFIER
      printf 'Warning: Ignoring %s. Expected a scrypt verifier.\n' "$verifier_file" >&2
      ;;
  esac
fi
if [ -f "$secrets_dir/postmark-token" ]; then
  POSTMARK_SERVER_TOKEN=$(cat "$secrets_dir/postmark-token")
  export POSTMARK_SERVER_TOKEN
fi
if [ -f "$secrets_dir/github-client-secret" ]; then
  MKC_GITHUB_CLIENT_SECRET=$(cat "$secrets_dir/github-client-secret")
  export MKC_GITHUB_CLIENT_SECRET
fi
if [ -f "$secrets_dir/github-app-key" ]; then
  MKC_GITHUB_PRIVATE_KEY=$(cat "$secrets_dir/github-app-key")
  export MKC_GITHUB_PRIVATE_KEY
fi
if [ -f "$secrets_dir/github-webhook-secret" ]; then
  MKC_GITHUB_WEBHOOK_SECRET=$(cat "$secrets_dir/github-webhook-secret")
  export MKC_GITHUB_WEBHOOK_SECRET
fi
if [ -f "$secrets_dir/e2b-api-key" ]; then
  MKC_E2B_API_KEY=$(cat "$secrets_dir/e2b-api-key")
  export MKC_E2B_API_KEY
fi
if [ -f "$secrets_dir/stripe-secret-key" ]; then
  MKC_STRIPE_SECRET_KEY=$(cat "$secrets_dir/stripe-secret-key")
  export MKC_STRIPE_SECRET_KEY
fi
if [ -f "$secrets_dir/stripe-webhook-secret" ]; then
  MKC_STRIPE_WEBHOOK_SECRET=$(cat "$secrets_dir/stripe-webhook-secret")
  export MKC_STRIPE_WEBHOOK_SECRET
fi
exec "${MKC_API_BIN:-/usr/local/bin/mkc-api}" "$@"
