#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
[[ $# -eq 0 ]] || { echo 'preview-platform.sh takes no arguments' >&2; exit 1; }
source infra/scripts/preview-platform-common.sh
preview_validate_inputs
preview_load_local_configuration
if ! command -v openssl >/dev/null 2>&1; then
  echo 'openssl is required to check the preview TLS certificate' >&2
  exit 1
fi
umask 077
preview_temporary=$(mktemp -d)
chmod 700 "$preview_temporary"
trap 'rm -rf "$preview_temporary"' EXIT
preview_select_cluster

issuer_manifest="$preview_temporary/cluster-issuer.yaml"
python3 - "$MKC_CATALOGUE_BASE_DOMAIN" "$issuer_manifest" <<'PY'
from pathlib import Path
import os
import sys

source = Path("infra/helm/platform/cluster-issuer.yaml").read_text()
placeholder = "__MKC_CATALOGUE_BASE_DOMAIN__"
if source.count(placeholder) != 1:
    raise SystemExit("ClusterIssuer template must contain one catalogue-domain placeholder")
Path(sys.argv[2]).write_text(source.replace(placeholder, sys.argv[1]))
os.chmod(sys.argv[2], 0o600)
PY

cert_manager_manifest="$preview_temporary/cert-manager.yaml"
ingress_nginx_manifest="$preview_temporary/ingress-nginx.yaml"
helm template cert-manager cert-manager --repo https://charts.jetstack.io \
  --version "$cert_manager_chart_version" --namespace "$preview_namespace" \
  -f infra/helm/platform/cert-manager-values.yaml > "$cert_manager_manifest"
escaped_cloudflare_cidrs=${cloudflare_cidrs//,/\\,}
helm template ingress-nginx ingress-nginx \
  --repo https://kubernetes.github.io/ingress-nginx \
  --version "$ingress_nginx_chart_version" --namespace "$preview_namespace" \
  -f infra/helm/platform/ingress-nginx-values.yaml \
  --set-string "controller.service.loadBalancerIP=$MKC_PREVIEW_INGRESS_IP" \
  --set-string "controller.config.proxy-real-ip-cidr=$escaped_cloudflare_cidrs" \
  > "$ingress_nginx_manifest"
inventory="$preview_temporary/cluster-inventory.tsv"
python3 infra/scripts/preview-platform-helper.py inventory \
  "$cert_manager_manifest" "$ingress_nginx_manifest" "$issuer_manifest" > "$inventory"
chmod 600 "$cert_manager_manifest" "$ingress_nginx_manifest" "$inventory"

authorization_verbs=(create get list watch update patch delete)
while IFS=$'\t' read -r kind name resource; do
  for verb in "${authorization_verbs[@]}"; do
    target="$resource/$name"
    [[ "$verb" != list && "$verb" != watch ]] || target="$resource"
    if ! preview_kubectl auth can-i "$verb" "$target" --all-namespaces --quiet; then
      echo "Authorization denied for $verb on $kind/$name" >&2
      exit 1
    fi
  done
done < "$inventory"

preview_kubectl create namespace "$preview_namespace" --dry-run=client -o json | \
  preview_kubectl apply -f - >/dev/null
preview_kubectl label namespace "$preview_namespace" \
  "kubernetes.io/metadata.name=$preview_namespace" --overwrite >/dev/null
for purpose in key cert; do
  gcloud secrets versions access latest --project="$preview_project" \
    --secret="mkc-preview-origin-tls-$purpose" \
    --out-file="$preview_temporary/tls.$purpose" >/dev/null
  chmod 600 "$preview_temporary/tls.$purpose"
  [[ -s "$preview_temporary/tls.$purpose" ]] || { echo "Preview TLS $purpose is empty" >&2; exit 1; }
done
gcloud secrets versions access latest --project="$preview_project" \
  --secret=mkc-catalogue-dns-token \
  --out-file="$preview_temporary/api-token" >/dev/null
chmod 600 "$preview_temporary/api-token"
[[ -s "$preview_temporary/api-token" ]] || { echo 'Catalogue DNS token is empty' >&2; exit 1; }
preview_validate_tls "$preview_temporary/tls.cert" "$preview_temporary/tls.key"
preview_kubectl --namespace "$preview_namespace" create secret tls preview-origin-tls \
  --key="$preview_temporary/tls.key" --cert="$preview_temporary/tls.cert" \
  --dry-run=client -o json | preview_kubectl apply -f - >/dev/null
preview_kubectl --namespace "$preview_namespace" create secret generic catalogue-dns-token \
  --from-file="api-token=$preview_temporary/api-token" --type=Opaque \
  --dry-run=client -o json | preview_kubectl apply -f - >/dev/null

helm upgrade --install cert-manager cert-manager --repo https://charts.jetstack.io \
  --version "$cert_manager_chart_version" --namespace "$preview_namespace" \
  -f infra/helm/platform/cert-manager-values.yaml --wait --timeout 15m >/dev/null
helm upgrade --install ingress-nginx ingress-nginx \
  --repo https://kubernetes.github.io/ingress-nginx \
  --version "$ingress_nginx_chart_version" --namespace "$preview_namespace" \
  -f infra/helm/platform/ingress-nginx-values.yaml \
  --set-string "controller.service.loadBalancerIP=$MKC_PREVIEW_INGRESS_IP" \
  --set-string "controller.config.proxy-real-ip-cidr=$escaped_cloudflare_cidrs" \
  --wait --timeout 15m >/dev/null
preview_kubectl apply -f "$issuer_manifest" >/dev/null
if ! preview_wait_for_readiness 900; then
  echo "Preview platform installation failed readiness at $preview_failed_resource" >&2
  exit 1
fi

echo 'Preview platform ready'
echo "Namespace: $preview_namespace"
echo "cert-manager chart: $cert_manager_chart_version"
echo "ingress-nginx chart: $ingress_nginx_chart_version"
echo "Address: $MKC_PREVIEW_INGRESS_IP"
echo 'Cluster-scoped authorization inventory:'
while IFS=$'\t' read -r kind name resource; do
  echo "$kind/$name"
done < "$inventory"
