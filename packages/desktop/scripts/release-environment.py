"""Resolve desktop build inputs from the deployment domain owner."""

import argparse
import json
import os
from pathlib import Path
import runpy
import sys
from urllib.parse import urlsplit
from urllib.request import urlopen


ROOT = Path(__file__).resolve().parents[3]
SCRIPTS = ROOT / "infra/scripts"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("environment", choices=("production", "main-preview"))
    parser.add_argument("--tag")
    args = parser.parse_args()
    package = json.loads((ROOT / "packages/desktop/package.json").read_text())
    if args.tag is not None:
        version = package["version"]
        if args.tag != "desktop-v" + version:
            parser.error(f"Release tag must equal desktop-v{version}")
    # The helpers import their sibling modules, as when Python runs the script.
    if str(SCRIPTS) not in sys.path:
        sys.path.insert(0, str(SCRIPTS))
    layout = runpy.run_path(str(SCRIPTS / "render-values.py"))
    domain = os.environ.get("MKC_DOMAIN", "")
    catalogue_base = os.environ.get("MKC_CATALOGUE_BASE_DOMAIN", "")
    # Fork pull requests receive no repository variables. Reuse the public
    # deployment metadata and the package's existing public homepage instead.
    if args.environment == "main-preview":
        domain = domain or urlsplit(package["homepage"]).hostname
    api, app, _ = layout["domain_layout"](args.environment, domain)
    if args.environment == "main-preview" and not catalogue_base:
        with urlopen(app + "/_config", timeout=30) as response:
            catalogue_base = json.load(response)["catalogueBaseDomain"]
    catalogue = layout["catalogue_domain"](args.environment, catalogue_base)
    print(f"EXPO_PUBLIC_MKC_API_ORIGIN={api}")
    print(f"EXPO_PUBLIC_MKC_APP_ORIGIN={app}")
    print(f"MKC_CATALOGUE_BASE_DOMAIN={catalogue}")


if __name__ == "__main__":
    main()
