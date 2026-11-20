#!/usr/bin/env bash
# Shared preview-platform validation and read-only readiness checks.
set -euo pipefail

readonly preview_namespace=mkc-preview-system
readonly preview_cluster=mkc-autopilot
readonly preview_project=mokly-508518
readonly preview_ingress_class=mkc-preview
readonly preview_ingress_controller=mokly.ai/preview-ingress-nginx
readonly preview_issuer=mkc-preview-letsencrypt
readonly preview_ingress_service=ingress-nginx-controller
readonly preview_diagnostic="Preview platform is not ready; run deploy.yml's preview-platform job."

preview_validate_inputs() {
  python3 infra/scripts/preview-platform-helper.py validate-inputs
}

preview_load_local_configuration() {
  cert_manager_chart_version=$(python3 -c 'import json; print(json.load(open("infra/toolchains.json"))["cert_manager_chart"])')
  ingress_nginx_chart_version=$(python3 -c 'import json; print(json.load(open("infra/toolchains.json"))["ingress_nginx_chart"])')
  cloudflare_cidrs=$(python3 infra/scripts/preview-platform-helper.py cloudflare-cidrs infra/helm/mokly-cloud/values.yaml)
  [[ -f infra/helm/platform/cert-manager-values.yaml ]] || { echo 'Missing cert-manager platform values' >&2; return 1; }
  [[ -f infra/helm/platform/ingress-nginx-values.yaml ]] || { echo 'Missing ingress-nginx platform values' >&2; return 1; }
  [[ -f infra/helm/platform/cluster-issuer.yaml ]] || { echo 'Missing preview ClusterIssuer template' >&2; return 1; }
}

preview_select_cluster() {
  export KUBECONFIG="$preview_temporary/kubeconfig"
  : > "$KUBECONFIG"
  chmod 600 "$KUBECONFIG"
  preview_kube_context="gke_${preview_project}_${MKC_REGION}_${preview_cluster}"
  gcloud container clusters get-credentials "$preview_cluster" \
    --region="$MKC_REGION" --project="$preview_project" --dns-endpoint >/dev/null
}

preview_kubectl() {
  kubectl --kubeconfig "$KUBECONFIG" --context "$preview_kube_context" "$@"
}

preview_not_ready() {
  echo "$preview_diagnostic Failing resource: $1." >&2
  exit 1
}

preview_validate_tls() {
  local certificate=$1
  local key=$2
  local key_digest cert_digest
  if ! openssl x509 -in "$certificate" -noout >/dev/null 2>&1; then
    echo 'Preview TLS certificate cannot be read' >&2
    return 1
  fi
  if ! openssl x509 -in "$certificate" -checkend 86400 -noout >/dev/null 2>&1; then
    echo 'Preview TLS certificate is expired or expires within 24 hours' >&2
    return 1
  fi
  if ! openssl x509 -in "$certificate" -noout -ext subjectAltName 2>/dev/null | \
    python3 infra/scripts/preview-platform-helper.py sans \
      "*.preview.$MKC_DOMAIN" "*.preview.api.$MKC_DOMAIN"; then
    return 1
  fi
  if ! key_digest=$(openssl pkey -in "$key" -pubout -outform DER 2>/dev/null | \
    sha256sum | cut -d ' ' -f 1) || [[ -z "$key_digest" ]]; then
    echo 'Preview TLS key cannot be read' >&2
    return 1
  fi
  if ! cert_digest=$(openssl x509 -in "$certificate" -pubkey -noout 2>/dev/null | \
    openssl pkey -pubin -outform DER 2>/dev/null | sha256sum | cut -d ' ' -f 1) || \
    [[ -z "$cert_digest" ]]; then
    echo 'Preview TLS certificate cannot be read' >&2
    return 1
  fi
  if [[ "$key_digest" != "$cert_digest" ]]; then
    echo 'Preview TLS key and certificate do not match' >&2
    return 1
  fi
  return 0
}

preview_check_origin_tls() {
  local directory
  if ! directory=$(mktemp -d "$preview_temporary/tls.XXXXXX"); then
    return 1
  fi
  chmod 700 "$directory" || return 1
  if ! preview_kubectl --namespace "$preview_namespace" get secret preview-origin-tls -o json | \
    python3 infra/scripts/preview-platform-helper.py tls-secret "$directory"; then
    return 1
  fi
  preview_validate_tls "$directory/tls.crt" "$directory/tls.key" || return 1
}

preview_check_secret() {
  local name=$1
  local secret_type=$2
  shift 2
  preview_kubectl --namespace "$preview_namespace" get secret "$name" -o json 2>/dev/null | \
    python3 infra/scripts/preview-platform-helper.py secret "$name" "$secret_type" "$@"
}

preview_check_static_readiness() {
  if ! { preview_kubectl get namespace "$preview_namespace" -o json | \
    python3 infra/scripts/preview-platform-helper.py namespace "$preview_namespace"; } 2>/dev/null; then
    preview_failed_resource="Namespace/$preview_namespace"
    return 1
  fi
  local deployment
  for deployment in cert-manager cert-manager-webhook cert-manager-cainjector ingress-nginx-controller; do
    local remaining=$((preview_readiness_deadline - SECONDS))
    if (( remaining <= 0 )); then
      preview_failed_resource="Deployment/$deployment"
      return 1
    fi
    if ! preview_kubectl --namespace "$preview_namespace" rollout status "deployment/$deployment" \
      --timeout="${remaining}s" >/dev/null 2>&1; then
      preview_failed_resource="Deployment/$deployment"
      return 1
    fi
  done
  if ! { preview_kubectl get ingressclass "$preview_ingress_class" -o json | \
    python3 infra/scripts/preview-platform-helper.py ingress-class \
      "$preview_ingress_class" "$preview_ingress_controller"; } 2>/dev/null; then
    preview_failed_resource="IngressClass/$preview_ingress_class"
    return 1
  fi
  if ! preview_check_origin_tls 2>/dev/null; then
    preview_failed_resource='Secret/preview-origin-tls'
    return 1
  fi
  if ! preview_check_secret catalogue-dns-token Opaque api-token 2>/dev/null; then
    preview_failed_resource='Secret/catalogue-dns-token'
    return 1
  fi
}

preview_wait_for_readiness() {
  preview_readiness_timeout=$1
  preview_readiness_deadline=$((SECONDS + preview_readiness_timeout))
  preview_failed_resource='preview platform'
  preview_check_static_readiness || return 1
  local issuer_status service_status
  while true; do
    if ! issuer_status=$({ preview_kubectl get clusterissuer "$preview_issuer" -o json | \
      python3 infra/scripts/preview-platform-helper.py issuer "$preview_issuer"; } 2>/dev/null); then
      preview_failed_resource="ClusterIssuer/$preview_issuer"
      return 1
    fi
    if ! service_status=$({ preview_kubectl --namespace "$preview_namespace" get service \
      "$preview_ingress_service" -o json | \
      python3 infra/scripts/preview-platform-helper.py service \
        "$preview_ingress_service" "$MKC_PREVIEW_INGRESS_IP"; } 2>/dev/null); then
      preview_failed_resource="Service/$preview_ingress_service"
      return 1
    fi
    if [[ "$service_status" == wrong ]]; then
      preview_failed_resource="Service/$preview_ingress_service"
      return 1
    fi
    if [[ "$issuer_status" == ready && "$service_status" == ready ]]; then
      return 0
    fi
    if (( SECONDS >= preview_readiness_deadline )); then
      if [[ "$issuer_status" != ready ]]; then
        preview_failed_resource="ClusterIssuer/$preview_issuer"
      else
        preview_failed_resource="Service/$preview_ingress_service"
      fi
      return 1
    fi
    sleep 5
  done
}
