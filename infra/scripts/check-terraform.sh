#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
terraform fmt -check -recursive infra/terraform
mkdir -p .context/terraform-plugin-cache
export TF_PLUGIN_CACHE_DIR="$PWD/.context/terraform-plugin-cache"
for root in infra/terraform/modules/* infra/terraform/bootstrap infra/terraform/foundation infra/terraform/environment; do
  echo "Checking $root"
  terraform -chdir="$root" init -backend=false -input=false -lockfile=readonly -no-color
  terraform -chdir="$root" validate -no-color
  terraform -chdir="$root" test -no-color
done
