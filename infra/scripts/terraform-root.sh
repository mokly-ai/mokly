#!/usr/bin/env bash
# Plan, check or apply one Terraform root. The root entry points source this
# file after validating their inputs, set the variables below and call
# terraform_root with the action. Sourcing this file performs no provider call.
#
#   root_directory        Terraform root, relative to the repository
#   backend_prefix        GCS state prefix of the root instance
#   plan_directory        Absolute directory for release.tfplan, plan.txt and plan.json
#   plan_token            Cloudflare token ID for plan and check
#   ci_apply_token        Cloudflare token ID for an apply in GitHub Actions
#   operator_apply_token  Cloudflare token ID for an apply outside GitHub Actions
#   trusted_workflow      The only workflow file that may apply in GitHub Actions
#   policy_root           Root name for terraform-plan-policy.py
terraform_root() {
  local action=${1:-} token_id result=0
  [[ "$action" =~ ^(plan|check|apply)$ ]] || { echo 'Unknown plan action' >&2; exit 1; }
  mkdir -p "$plan_directory"
  chmod 700 "$plan_directory"
  if [[ "${GITHUB_ACTIONS:-false}" == true && "$action" == apply ]]; then
    [[ "${GITHUB_EVENT_NAME:-}" =~ ^(push|workflow_dispatch)$ && "${GITHUB_REF:-}" == refs/heads/main && "${GITHUB_WORKFLOW_REF:-}" == "mokly-ai/mokly-cloud/.github/workflows/$trusted_workflow@refs/heads/main" ]] || {
      echo "CI apply requires the trusted ${trusted_workflow%.yml} workflow on main" >&2
      exit 1
    }
  fi
  token_id=$plan_token
  if [[ "$action" == apply ]]; then
    token_id=$operator_apply_token
    [[ "${GITHUB_ACTIONS:-false}" != true ]] || token_id=$ci_apply_token
  fi
  export CLOUDFLARE_API_TOKEN
  CLOUDFLARE_API_TOKEN=$(gcloud secrets versions access latest --secret="$token_id" --project=mokly-508518)
  terraform -chdir="$root_directory" init -reconfigure -input=false \
    -backend-config="bucket=${MKC_STATE_BUCKET:?}" \
    -backend-config="prefix=$backend_prefix"
  if [[ "$action" == apply ]]; then
    [[ -f "$plan_directory/release.tfplan" ]] || { echo 'Run plan and review plan.txt before apply' >&2; exit 1; }
    terraform -chdir="$root_directory" show -json "$plan_directory/release.tfplan" > "$plan_directory/plan.json"
    python3 infra/scripts/terraform-plan-policy.py check "$policy_root" "$plan_directory/plan.json"
    terraform -chdir="$root_directory" apply -input=false -lock-timeout=5m "$plan_directory/release.tfplan"
  else
    terraform -chdir="$root_directory" plan -input=false -no-color -detailed-exitcode \
      -lock-timeout=5m -out="$plan_directory/release.tfplan" > "$plan_directory/plan.txt" 2>&1 || result=$?
    cat "$plan_directory/plan.txt"
    [[ "$result" == 0 || "$result" == 2 ]] || exit "$result"
    terraform -chdir="$root_directory" show -json "$plan_directory/release.tfplan" > "$plan_directory/plan.json"
    python3 infra/scripts/terraform-plan-policy.py check "$policy_root" "$plan_directory/plan.json"
    if [[ "$action" == check && "$result" == 2 ]]; then
      echo 'Infrastructure changes detected: review the saved plan before applying' >&2
      exit 2
    fi
  fi
}
