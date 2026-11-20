"""Keep every independently consumed domain-layout contract in lockstep."""

import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import unittest

from support import ROOT, load


DOMAIN = "example.invalid"
ENVIRONMENTS = ("production", "main-preview", "preview-pr-42")
GOLDENS = {
    "production": "production.yaml",
    "main-preview": "main-preview.yaml",
    "preview-pr-42": "preview-pr.yaml",
}
TERRAFORM_RUNS = {
    "production": "production_uses_universal_ssl",
    "main-preview": "contracts",
}


def layout(internal_app_host, public_api_host, public_app_origin):
    return {
        "internalAppHost": internal_app_host,
        "publicApiHost": public_api_host,
        "publicAppOrigin": public_app_origin,
    }


def python_layout(function, environment):
    api_origin, app_origin, internal_app_host = function(environment, DOMAIN)
    return layout(internal_app_host, api_origin.removeprefix("https://"), app_origin)


def only(matches, label):
    values = set(matches)
    if len(values) != 1:
        raise AssertionError(f"expected one {label}, found {sorted(values)}")
    return values.pop()


def helm_layout(environment):
    helper = ROOT / "infra/helm/mokly-cloud/templates/_helpers.tpl"
    helper_text = helper.read_text()
    if 'define "mkc.host"' not in helper_text or 'define "mkc.publicAppOrigin"' not in helper_text:
        raise AssertionError(f"domain-layout helpers moved from {helper}")
    path = ROOT / "infra/helm/tests/golden" / GOLDENS[environment]
    golden = path.read_text()
    api = only(re.findall(
        r'name: EXPO_PUBLIC_MKC_API_ORIGIN\s+value: "https://([^"]+)"', golden
    ), f"API origin in {path}")
    public = only(re.findall(
        r'name: EXPO_PUBLIC_MKC_APP_ORIGIN\s+value: "([^"]+)"', golden
    ), f"public app origin in {path}")
    internal = only(re.findall(
        r'^    - host: "(app-origin[^"]+)"$', golden, re.MULTILINE
    ), f"internal app host in {path}")
    return layout(internal, api, public)


def terraform_run(text, name):
    marker = f'run "{name}"'
    start = text.index(marker)
    following = text.find('\nrun "', start + len(marker))
    return text[start:] if following == -1 else text[start:following]


def terraform_layout(environment):
    if environment == "preview-pr-42":
        path = ROOT / "infra/terraform/foundation/contracts.tftest.hcl"
        block = terraform_run(path.read_text(), "shared_preview_dns")
        app_wildcard = only(re.findall(
            r'preview_placeholder.name == "(\*\.preview\.[^"]+)"', block
        ), "foundation app wildcard")
        api_wildcard = only(re.findall(
            r'preview_api.name == "(\*\.preview\.api\.[^"]+)"', block
        ), "foundation API wildcard")
        expected = layout("app-origin-pr-42.preview.example.invalid",
                          "pr-42.preview.api.example.invalid",
                          "https://pr-42.preview.example.invalid")
        for host, wildcard in (
            (expected["internalAppHost"], app_wildcard),
            (expected["publicAppOrigin"].removeprefix("https://"), app_wildcard),
            (expected["publicApiHost"], api_wildcard),
        ):
            if host.split(".", 1)[1] != wildcard.removeprefix("*."):
                raise AssertionError(f"{host} is not covered by {wildcard}")
        return expected
    path = ROOT / "infra/terraform/modules/dns/contracts.tftest.hcl"
    block = terraform_run(path.read_text(), TERRAFORM_RUNS[environment])
    internal = only(re.findall(
        r'"(app-origin[^"]*\.example\.invalid)"', block
    ), f"Terraform internal app host for {environment}")
    api = only(re.findall(
        r'"((?:api|[^".]+\.preview\.api)\.example\.invalid)"', block
    ), f"Terraform API host for {environment}")
    public = only(re.findall(
        r'"(https://(?:example\.invalid|[^".]+\.preview\.example\.invalid))"', block
    ), f"Terraform public app origin for {environment}")
    return layout(internal, api, public)


def worker_layouts():
    worker = ROOT / "apps/worker/src/index.ts"
    runner = ROOT / "node_modules/.bin/tsx"
    script = (
        f'import {{ domainLayout }} from "./{worker.relative_to(ROOT)}";'
        f'console.log(JSON.stringify({json.dumps(ENVIRONMENTS)}.map('
        f'(environment) => [environment, domainLayout(environment, "{DOMAIN}")])));'
    )
    result = subprocess.run(
        [str(runner), "--eval", script],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
        timeout=30,
    )
    return dict(json.loads(result.stdout))


def worker_routes():
    source = ROOT / "apps/worker/scripts/render-wrangler.mjs"
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        scripts = root / "scripts"
        scripts.mkdir()
        script = scripts / source.name
        script.write_bytes(source.read_bytes())
        subprocess.run(
            ["node", str(script)],
            check=True,
            capture_output=True,
            text=True,
            timeout=30,
            env={
                **os.environ,
                "MKC_DOMAIN": DOMAIN,
                "MKC_CLOUDFLARE_ZONE_ID": "0" * 32,
            },
        )
        return json.loads((root / "wrangler.json").read_text())["routes"]


def typescript_site_segments():
    runner = ROOT / "node_modules/.bin/tsx"
    script = """
import { SITE_FIRST_SEGMENTS as worker } from "./apps/worker/src/site-segments.ts";
import { SITE_OUTPUT_FIRST_SEGMENTS, SITE_PATHS } from "./apps/site/src/navigation.ts";
const site = new Set(SITE_OUTPUT_FIRST_SEGMENTS);
for (const route of Object.values(SITE_PATHS)) {
  const segment = route.split("/")[1];
  if (segment) site.add(segment);
}
console.log(JSON.stringify({ worker, site: [...site].sort() }));
"""
    result = subprocess.run(
        [str(runner), "--eval", script], cwd=ROOT, check=True,
        capture_output=True, text=True, timeout=30,
    )
    return json.loads(result.stdout)


def rust_array(name):
    source = (ROOT / "crates/mkc-domain/src/slug.rs").read_text()
    match = re.search(
        rf"pub const {name}: &\[&str\] = &\[(.*?)\];", source, re.DOTALL
    )
    if not match:
        raise AssertionError(f"missing Rust route segment array {name}")
    return re.findall(r'"([^"]+)"', match.group(1))


EXPO_ROUTE_EXTENSIONS = (".tsx", ".jsx", ".ts", ".js")
EXPO_PLATFORM_SUFFIXES = (".web", ".native", ".ios", ".android")


def expo_route_stem(path):
    stem = next(
        (
            path.name.removesuffix(extension)
            for extension in EXPO_ROUTE_EXTENSIONS
            if path.name.endswith(extension)
        ),
        None,
    )
    if stem is None:
        return None
    platform = next(
        (suffix for suffix in EXPO_PLATFORM_SUFFIXES if stem.endswith(suffix)),
        None,
    )
    if platform is not None:
        stem = stem.removesuffix(platform)
    if stem in ("index", "_layout") or stem.startswith(("[", "+")):
        return None
    return stem


def expo_directory_contains_route(directory):
    for entry in directory.iterdir():
        if entry.is_dir() and expo_directory_contains_route(entry):
            return True
        if (
            entry.is_file()
            and any(
                entry.name.endswith(extension) for extension in EXPO_ROUTE_EXTENSIONS
            )
            and not entry.name.startswith(("_layout.", "+"))
        ):
            return True
    return False


def collect_expo_first_segments(directory, segments):
    for entry in directory.iterdir():
        if entry.is_file():
            stem = expo_route_stem(entry)
            if stem is not None:
                segments.add(stem)
        elif entry.name.startswith("(") and entry.name.endswith(")"):
            collect_expo_first_segments(entry, segments)
        elif (
            not entry.name.startswith(("[", "+"))
            and entry.name != "_layout"
            and expo_directory_contains_route(entry)
        ):
            segments.add(entry.name)


def expo_static_first_segments(routes=None):
    routes = ROOT / "apps/app/app" if routes is None else routes
    segments = set()
    collect_expo_first_segments(routes, segments)
    return sorted(segments)


def write_expo_routes(root, routes):
    for route in routes:
        path = root / route
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("export default function Route() {}")


class ExpoRouteDiscoveryTests(unittest.TestCase):
    def test_special_files_and_directories_are_not_url_segments(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            write_expo_routes(
                root,
                [
                    "+not-found.tsx",
                    "+html.tsx",
                    "+special/index.tsx",
                    "dashboard.tsx",
                ],
            )
            self.assertEqual(expo_static_first_segments(root), ["dashboard"])

    def test_groups_flatten_and_dynamic_or_platform_names_are_handled(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            write_expo_routes(
                root,
                [
                    "_layout.tsx",
                    "index.tsx",
                    "dashboard.web.tsx",
                    "(account)/sign-in.native.tsx",
                    "(account)/[token].tsx",
                    "(product)/settings/index.ios.tsx",
                    "[workspace]/index.tsx",
                    "layout-only/_layout.android.tsx",
                    "special-only/+not-found.tsx",
                ],
            )
            self.assertEqual(
                expo_static_first_segments(root),
                ["dashboard", "settings", "sign-in"],
            )


class DomainLayoutDriftTests(unittest.TestCase):
    def test_worker_routes_cover_the_complete_public_origins(self):
        self.assertEqual(worker_routes(), [
            {"pattern": f"{DOMAIN}/*", "zone_id": "0" * 32},
            {"pattern": f"*.preview.{DOMAIN}/*", "zone_id": "0" * 32},
        ])

    def test_site_route_segments_match_worker_and_domain_reservations(self):
        typescript = typescript_site_segments()
        self.assertEqual(typescript["worker"], typescript["site"])
        self.assertEqual(typescript["worker"], rust_array("SITE_FIRST_SEGMENTS"))
        self.assertEqual(rust_array("EXPLICIT_SITE_FIRST_SEGMENTS"), [".well-known"])

    def test_expo_static_routes_match_domain_app_reservations(self):
        expo = expo_static_first_segments()
        self.assertEqual(expo, rust_array("EXPO_STATIC_FIRST_SEGMENTS"))
        self.assertTrue(set(expo).issubset(rust_array("APP_FIRST_SEGMENTS")))

    def test_all_domain_layout_sources_match_for_every_environment(self):
        render_values = load("render-values")
        worker = worker_layouts()
        for environment in ENVIRONMENTS:
            expected = python_layout(render_values.domain_layout, environment)
            sources = {
                "Helm golden": helm_layout(environment),
                "Terraform contract": terraform_layout(environment),
                "Worker": worker[environment],
            }
            for source, actual in sources.items():
                with self.subTest(environment=environment, source=source):
                    self.assertEqual(actual, expected)


if __name__ == "__main__":
    unittest.main()
