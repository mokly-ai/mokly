#!/usr/bin/env bash
# Shared validation, cluster selection and generated-Secret handling for PR previews.
set -euo pipefail

readonly preview_project=mokly-508518
readonly preview_cluster=mkc-autopilot
readonly preview_release=mokly-cloud

preview_initialize() {
  environment=$1
  [[ "$environment" =~ ^preview-pr-([1-9][0-9]{0,8})$ ]] || {
    echo 'This command accepts only preview-pr-N' >&2
    return 1
  }
  pr_number=${BASH_REMATCH[1]}
  namespace="mkc-$environment"
  object_prefix="pr-$pr_number"
  python3 infra/scripts/preview-platform-helper.py validate-inputs
  python3 infra/scripts/preview-lifecycle.py validate "$environment"
}

preview_create_temporary() {
  umask 077
  preview_temporary=$(mktemp -d "${RUNNER_TEMP:-/tmp}/mokly-preview.XXXXXXXX")
  chmod 700 "$preview_temporary"
  export KUBECONFIG="$preview_temporary/kubeconfig"
  : > "$KUBECONFIG"
  chmod 600 "$KUBECONFIG"
  preview_kube_context="gke_${preview_project}_${MKC_REGION}_${preview_cluster}"
}

preview_select_cluster() {
  gcloud container clusters get-credentials "$preview_cluster" \
    --region="$MKC_REGION" --project="$preview_project" --dns-endpoint >/dev/null
}

preview_kubectl() {
  kubectl --kubeconfig "$KUBECONFIG" --context "$preview_kube_context" "$@"
}

preview_secret_validator() {
  case "$1" in
    postgres-credentials) echo validate-postgres-secret ;;
    catalogue-signing-key) echo validate-signing-secret ;;
    *) echo "Unknown generated Secret: $1" >&2; return 1 ;;
  esac
}

preview_generate_secret_files() {
  local name=$1
  local directory=$2
  mkdir -p "$directory"
  if [[ "$name" == postgres-credentials ]]; then
    python3 infra/scripts/preview-lifecycle.py generate-postgres "$directory"
  else
    python3 infra/scripts/preview-lifecycle.py generate-signing "$directory"
  fi
}

preview_create_secret() {
  local name=$1
  local directory=$2
  local error_file=$3
  local options=()
  if [[ "$name" == postgres-credentials ]]; then
    options=(--from-file="password=$directory/password" --from-file="url=$directory/url")
  else
    options=(--from-file="catalogue-signing-key=$directory/catalogue-signing-key")
  fi
  local status
  if preview_kubectl --namespace "$namespace" create secret generic "$name" \
    "${options[@]}" > /dev/null 2> "$error_file"; then
    return 0
  else
    status=$?
  fi
  local diagnostic
  diagnostic=$(<"$error_file")
  if [[ "$diagnostic" == *'(AlreadyExists)'* ]]; then
    return 0
  fi
  echo "$diagnostic" >&2
  return "$status"
}

preview_ensure_secret() {
  local name=$1
  local pvc_present=$2
  local secret_file="$preview_temporary/$name.json"
  local validator
  validator=$(preview_secret_validator "$name")
  preview_kubectl --namespace "$namespace" get secret "$name" \
    --ignore-not-found -o json > "$secret_file"
  if [[ -s "$secret_file" ]]; then
    python3 infra/scripts/preview-lifecycle.py "$validator" < "$secret_file"
    return
  fi
  if [[ "$pvc_present" == true ]]; then
    echo "PVC/data-postgres-0 exists but Secret/$name is missing; restore the original Secret or delete the namespace before retrying." >&2
    return 1
  fi
  local secret_directory="$preview_temporary/$name"
  preview_generate_secret_files "$name" "$secret_directory"
  preview_create_secret "$name" "$secret_directory" "$preview_temporary/$name-create.stderr"
  preview_kubectl --namespace "$namespace" get secret "$name" -o json > "$secret_file"
  python3 infra/scripts/preview-lifecycle.py "$validator" < "$secret_file"
}

preview_fetch_dns_token() {
  preview_dns_token="$preview_temporary/catalogue-dns-token"
  gcloud secrets versions access latest --project="$preview_project" \
    --secret=mkc-catalogue-dns-token --out-file="$preview_dns_token" >/dev/null
  chmod 600 "$preview_dns_token"
}

preview_sync_verifier() {
  local verifier="$preview_temporary/verifier"
  local diagnostic="$preview_temporary/verifier-access.stderr"
  local current="$preview_temporary/current-preview-sign-in.json"
  local manifest="$preview_temporary/preview-sign-in.json"
  local store_result=read
  local status
  : > "$verifier"
  if gcloud secrets versions access latest --project="$preview_project" --verbosity=error \
    --secret=mkc-preview-sign-in-password --out-file="$verifier" >/dev/null 2>"$diagnostic"; then
    :
  else
    status=$?
    local no_versions='^ERROR: \(gcloud\.secrets\.versions\.access\) NOT_FOUND: Secret \[projects/([0-9]+|mokly-508518)/secrets/mkc-preview-sign-in-password\] not found or has no versions\.'
    local credentials='( This command is authenticated (as|with) [^[:cntrl:]]+\.)?$'
    if [[ "$status" == 1 && $(<"$diagnostic") =~ $no_versions$credentials ]]; then
      echo '::warning::mkc-preview-sign-in-password has no versions.' >&2
      store_result=missing
    else
      echo "::warning::Could not read mkc-preview-sign-in-password (gcloud exit $status)." >&2
      store_result=unavailable
    fi
  fi

  preview_kubectl --namespace "$namespace" get secret preview-sign-in \
    --ignore-not-found -o json > "$current"
  preview_sign_in_rollout_marker=$(
    python3 infra/scripts/preview-lifecycle.py prepare-preview-secret \
      "$store_result" "$verifier" "$manifest" < "$current"
  )
  if [[ -s "$manifest" ]]; then
    local operation=create
    [[ ! -s "$current" ]] || operation=replace
    if preview_kubectl --namespace "$namespace" "$operation" -f "$manifest" >/dev/null 2>&1; then
      :
    else
      status=$?
      echo "Could not $operation Secret/preview-sign-in (kubectl exit $status)." >&2
      return "$status"
    fi
  fi
  rm -f "$verifier" "$diagnostic" "$current" "$manifest"
}
