#!/usr/bin/env bash
# Plan, check or apply the shared foundation Terraform root.
set -euo pipefail
cd "$(dirname "$0")/../.."
[[ $# -eq 1 ]] || { echo 'Supply exactly one action: plan, check or apply; foundation takes no environment' >&2; exit 1; }
action=$1
[[ "$action" =~ ^(plan|check|apply)$ ]] || { echo 'Unknown plan action' >&2; exit 1; }
export TF_VAR_project=mokly-508518
export TF_VAR_region=${MKC_REGION:?Set MKC_REGION}
export TF_VAR_state_bucket=${MKC_STATE_BUCKET:?Set MKC_STATE_BUCKET}
export TF_VAR_domain=${MKC_DOMAIN:?Set MKC_DOMAIN}
export TF_VAR_zone_id=${MKC_CLOUDFLARE_ZONE_ID:?Set MKC_CLOUDFLARE_ZONE_ID}
export TF_VAR_repository_id=${MKC_REPOSITORY_ID:?Set MKC_REPOSITORY_ID to the numeric GitHub repository ID}
export TF_VAR_owner_id=${MKC_REPOSITORY_OWNER_ID:?Set MKC_REPOSITORY_OWNER_ID to the numeric GitHub owner ID}
export TF_VAR_legacy_repository_id=${MKC_LEGACY_REPOSITORY_ID:-}
[[ "$MKC_DOMAIN" =~ ^[a-z0-9][a-z0-9.-]+\.[a-z]+$ ]] || { echo 'Invalid domain' >&2; exit 1; }
[[ "$MKC_REGION" =~ ^[a-z]+-[a-z]+[0-9]+$ ]] || { echo 'Invalid region' >&2; exit 1; }
# The IDs form the federation trust condition; a wrong value locks CI out.
[[ "$MKC_REPOSITORY_ID" =~ ^[1-9][0-9]*$ && "$MKC_REPOSITORY_OWNER_ID" =~ ^[1-9][0-9]*$ ]] || {
  echo 'MKC_REPOSITORY_ID and MKC_REPOSITORY_OWNER_ID must be numeric GitHub IDs' >&2
  exit 1
}
[[ -z "$TF_VAR_legacy_repository_id" || "$TF_VAR_legacy_repository_id" =~ ^[1-9][0-9]*$ ]] || {
  echo 'MKC_LEGACY_REPOSITORY_ID must be empty or a numeric GitHub ID' >&2
  exit 1
}
source infra/scripts/terraform-root.sh
root_directory=infra/terraform/foundation
backend_prefix=foundation
plan_directory="$PWD/.context/plans/foundation"
plan_token=mkc-cloudflare-plan-token
ci_apply_token=mkc-cloudflare-foundation-token
operator_apply_token=mkc-cloudflare-api-token
trusted_workflow=foundation.yml
policy_root=foundation
terraform_root "$action"
