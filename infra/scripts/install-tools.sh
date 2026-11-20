#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
[[ "$(uname -sm)" == 'Linux x86_64' ]] || { echo 'Use the documented pinned releases for your platform' >&2; exit 1; }
tool_version() { python3 -c 'import json,sys; print(json.load(open("infra/toolchains.json"))[sys.argv[1]])' "$1"; }
temporary=$(mktemp -d)
trap 'rm -rf "$temporary"' EXIT
terraform_version=$(tool_version terraform)
helm_version=$(tool_version helm)
curl -fsSL --retry 3 "https://releases.hashicorp.com/terraform/$terraform_version/terraform_${terraform_version}_linux_amd64.zip" -o "$temporary/terraform_${terraform_version}_linux_amd64.zip"
curl -fsSL --retry 3 "https://releases.hashicorp.com/terraform/$terraform_version/terraform_${terraform_version}_SHA256SUMS" -o "$temporary/terraform.sums"
(cd "$temporary" && sha256sum --check --ignore-missing terraform.sums)
unzip -qo "$temporary/terraform_${terraform_version}_linux_amd64.zip" terraform -d "$temporary"
sudo install -m 755 "$temporary/terraform" /usr/local/bin/terraform
curl -fsSL --retry 3 "https://get.helm.sh/helm-v${helm_version}-linux-amd64.tar.gz" -o "$temporary/helm-v${helm_version}-linux-amd64.tar.gz"
curl -fsSL --retry 3 "https://get.helm.sh/helm-v${helm_version}-linux-amd64.tar.gz.sha256sum" -o "$temporary/helm.sums"
(cd "$temporary" && sha256sum --check helm.sums)
tar -xzf "$temporary/helm-v${helm_version}-linux-amd64.tar.gz" -C "$temporary"
sudo install -m 755 "$temporary/linux-amd64/helm" /usr/local/bin/helm
terraform version
helm version --short
