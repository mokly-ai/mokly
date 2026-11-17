"""Runtime-setting documentation and Helm renders stay in exact parity."""

from pathlib import Path
import json
import subprocess
import sys
import unittest

from support import ROOT, load


HELM_TESTS = ROOT / "infra/helm/tests"
if str(HELM_TESTS) not in sys.path:
    sys.path.insert(0, str(HELM_TESTS))

from runtime_settings import RuntimeSettingsParityError, check_parity, check_runtime_settings
from chart_support import CHART, environment, parse_yaml, resource

sys.path.insert(0, str(ROOT / "scripts"))
from smoke_support import Api

render = load("render-values")
admission = load("smoke_admission")
smoke = load("smoke")


def document(setting, deployment):
    return "\n".join(
        (
            "<!-- workload-settings:start -->",
            "| Setting | Deployment | Consumer and contract |",
            "| --- | --- | --- |",
            f"| `{setting}` | `{deployment}` | Fixture |",
            "<!-- workload-settings:end -->",
        )
    )


class RuntimeSettingsTests(unittest.TestCase):
    def test_rejects_documented_but_unrendered_setting(self):
        with self.assertRaisesRegex(RuntimeSettingsParityError, "documented but unrendered"):
            check_parity(document("MKC_FIXTURE", "env:api@production"), set())

    def test_rejects_undocumented_but_rendered_setting(self):
        actual = {("production", "api", "MKC_UNDOCUMENTED")}
        with self.assertRaisesRegex(RuntimeSettingsParityError, "rendered but undocumented"):
            check_parity(document("MKC_LOCAL_FIXTURE", "local-only"), actual)

    def test_operations_document_matches_every_golden_render(self):
        renders = {
            environment: (HELM_TESTS / "golden" / f"{environment}.yaml").read_text()
            for environment in ("production", "main-preview", "preview-pr")
        }
        document_text = (ROOT / "docs/ops/environment.md").read_text()
        check_runtime_settings(document_text, renders)

    def test_desktop_admission_is_documented_for_both_services_in_every_environment(self):
        actual = {(name, workload, "MKC_DESKTOP_CLIENT")
                  for name in ("production", "main-preview", "preview-pr")
                  for workload in ("api", "catalogue")}
        check_parity(document("MKC_DESKTOP_CLIENT", "env:api,catalogue@all"), actual)
        for missing in actual:
            with self.subTest(missing=missing):
                with self.assertRaisesRegex(RuntimeSettingsParityError, "documented but unrendered"):
                    check_parity(document("MKC_DESKTOP_CLIENT", "env:api,catalogue@all"), actual - {missing})

    def test_deployment_markers_keep_each_workload_environment_group(self):
        deployment = "env:api,catalogue@all`, `env:maintenance@production,main-preview"
        actual = {
            (name, workload, "MKC_FILE_STORE")
            for name in ("production", "main-preview", "preview-pr")
            for workload in ("api", "catalogue")
        } | {
            ("production", "maintenance", "MKC_FILE_STORE"),
            ("main-preview", "maintenance", "MKC_FILE_STORE"),
        }
        table = document("MKC_FILE_STORE", deployment)
        check_parity(table, actual)
        with self.assertRaisesRegex(RuntimeSettingsParityError, "documented but unrendered"):
            check_parity(table, actual - {("main-preview", "maintenance", "MKC_FILE_STORE")})


class DesktopSmokeParityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        build = subprocess.run(
            ["cargo", "build", "-p", "mkc-catalogue-server", "--message-format=json"],
            cwd=ROOT, capture_output=True, text=True, check=True, timeout=1200,
        )
        cls.executable = next(
            artifact["executable"] for line in build.stdout.splitlines()
            if (artifact := json.loads(line)).get("executable") and
            artifact.get("target", {}).get("name") == "mkc-catalogue-server"
        )

    def test_every_helm_environment_matches_real_catalogue_framing_and_cors(self):
        for path in sorted((CHART / "environments").glob("*.yaml")):
            with self.subTest(environment=path.stem):
                overlay = parse_yaml(path.read_text())[0]
                name = path.stem + ("-42" if path.stem == "preview-pr" else "")
                values = dict(overlay, prNumber=42, domain="example.invalid",
                              catalogueBaseDomain="catalogues.invalid",
                              region="us-central1", revision="a" * 40)
                api, app, domain, _, _, flag = render.origins(values, name, "a" * 40)
                config = smoke.configuration(dict(
                    MKC_API_ORIGIN=api, MKC_APP_ORIGIN=app, MKC_CATALOGUE_DOMAIN=domain,
                    MKC_REVISION="a" * 40, MKC_DESKTOP_CLIENT=flag,
                ))
                enabled = config[-1]
                self.assertIs(enabled, overlay["desktopClient"])
                documents = parse_yaml((HELM_TESTS / "golden" / f"{path.stem}.yaml").read_text())
                runtime = {}
                for workload in ("api", "catalogue"):
                    deployment = resource(documents, "Deployment", workload)
                    runtime[workload] = environment(deployment["spec"]["template"]["spec"]["containers"][0])
                    self.assertEqual(runtime[workload]["MKC_DESKTOP_CLIENT"], {"value": flag})
                server = Api(self.executable, isolated_database=True, overrides={
                    "MKC_DESKTOP_CLIENT": runtime["catalogue"]["MKC_DESKTOP_CLIENT"]["value"],
                    "MKC_APP_ORIGIN": app, "MKC_CATALOGUE_BIND": "127.0.0.1:0",
                })
                try:
                    client = smoke.HttpClient()
                    response = client.get(server.url + "/", app)
                    self.assertEqual(response.status, 404)
                    csp = response.headers["content-security-policy"]
                    actual = [part.strip().split()[1:] for part in csp.split(";")
                              if part.strip().startswith("frame-ancestors ")]
                    self.assertEqual(actual, [admission.frame_ancestors(app, enabled)])
                    admission.catalogue_headers(response.headers, app, enabled)
                    admission.cors(client, server.url + "/", app, enabled, "Catalogue", 404)
                    with self.assertRaisesRegex(ValueError, "frame-ancestors mismatch.*MKC_DESKTOP_CLIENT"):
                        admission.catalogue_headers(response.headers, app, not enabled)
                    with self.assertRaisesRegex(ValueError, "CORS mismatch.*MKC_DESKTOP_CLIENT"):
                        admission.cors(client, server.url + "/", app, not enabled, "Catalogue", 404)
                finally:
                    server.close()
                    server.process.stdout.close()


if __name__ == "__main__":
    unittest.main()
