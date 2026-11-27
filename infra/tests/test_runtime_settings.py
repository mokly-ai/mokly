"""Runtime-setting documentation and Helm renders stay in exact parity."""

import sys
import unittest

from support import ROOT, load


HELM_TESTS = ROOT / "infra/helm/tests"
if str(HELM_TESTS) not in sys.path:
    sys.path.insert(0, str(HELM_TESTS))

from runtime_settings import RuntimeSettingsParityError, check_parity, check_runtime_settings
from chart_support import CHART, environment, parse_yaml, resource

render = load("render-values")
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

    def test_every_helm_environment_configures_rollout_smoke(self):
        revision = "a" * 40
        for path in sorted((CHART / "environments").glob("*.yaml")):
            with self.subTest(environment=path.stem):
                overlay = parse_yaml(path.read_text())[0]
                name = path.stem + ("-42" if path.stem == "preview-pr" else "")
                values = dict(
                    overlay, prNumber=42, domain="example.invalid",
                    catalogueBaseDomain="catalogues.invalid",
                    region="us-central1", revision=revision,
                )
                api, app, domain, _, _, flag = render.origins(values, name, revision)
                config = smoke.configuration(dict(
                    MKC_API_ORIGIN=api, MKC_APP_ORIGIN=app, MKC_CATALOGUE_DOMAIN=domain,
                    MKC_REVISION=revision, MKC_DESKTOP_CLIENT=flag,
                ))
                self.assertIs(config[-1], overlay["desktopClient"])

                golden = HELM_TESTS / "golden" / path.name
                documents = parse_yaml(golden.read_text())
                for workload in ("api", "catalogue"):
                    deployment = resource(documents, "Deployment", workload)
                    container = deployment["spec"]["template"]["spec"]["containers"][0]
                    self.assertEqual(environment(container)["MKC_DESKTOP_CLIENT"], {"value": flag}, workload)


if __name__ == "__main__":
    unittest.main()
