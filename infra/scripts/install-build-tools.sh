#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
temporary=$(mktemp -d)
trap 'rm -rf "$temporary"' EXIT
buildkit=$(python3 -c 'import json; print(json.load(open("infra/toolchains.json"))["buildkit"])')
crane=$(python3 -c 'import json; print(json.load(open("infra/toolchains.json"))["crane"])')
curl -fsSL --retry 3 "https://github.com/moby/buildkit/releases/download/v$buildkit/buildkit-v$buildkit.linux-amd64.tar.gz" -o "$temporary/buildkit.tar.gz"
curl -fsSL --retry 3 "https://github.com/google/go-containerregistry/releases/download/v$crane/go-containerregistry_Linux_x86_64.tar.gz" -o "$temporary/crane.tar.gz"
printf '%s  %s\n' b6242896d343100808dcbe37565caf381e0a444a6a83d7255926bb1519248ead "$temporary/buildkit.tar.gz" | sha256sum --check
printf '%s  %s\n' 0ab7a1d6932a213aed964ce97666c3077fe691c8606413674a8b3e0b9ec4cda0 "$temporary/crane.tar.gz" | sha256sum --check
tar -xzf "$temporary/buildkit.tar.gz" -C "$temporary"
tar -xzf "$temporary/crane.tar.gz" -C "$temporary" crane
sudo install -m 755 "$temporary/bin/buildctl" "$temporary/bin/buildkitd" "$temporary/bin/buildkit-runc" "$temporary/crane" /usr/local/bin/
