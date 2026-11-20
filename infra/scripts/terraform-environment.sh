#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
source infra/scripts/environment.sh "${1:?Supply environment}"
action=${2:?Supply plan, check or apply}
source infra/scripts/terraform-root.sh
root_directory=infra/terraform/environment
backend_prefix="environments/$environment"
plan_directory="$PWD/.context/plans/$environment"
plan_token=mkc-cloudflare-plan-token
ci_apply_token=mkc-cloudflare-apply-token
operator_apply_token=mkc-cloudflare-api-token
trusted_workflow=deploy.yml
policy_root=$environment
terraform_root "$action"
