"""Complete release inputs cannot silently retarget baked origins or secret storage."""

import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from support import ROOT, load

render = load("render-values")


class ReleaseTests(unittest.TestCase):
    def test_release_admission_comes_from_each_helm_environment(self):
        for path in sorted((ROOT / "infra/helm/mokly-cloud/environments").glob("*.yaml")):
            environment = path.stem + ("-42" if path.stem == "preview-pr" else "")
            with self.subTest(environment=environment):
                result = render.values(environment, self.inputs())
                self.assertIs(result["desktopClient"], render.desktop_client(environment))
                self.assertEqual(render.origins(result, environment, "a" * 40)[5],
                                 str(result["desktopClient"]).lower())
                for value in (None, "true", not result["desktopClient"]):
                    wrong = dict(result, desktopClient=value)
                    with self.assertRaisesRegex(ValueError, "desktopClient.*Helm environment"):
                        render.origins(wrong, environment, "a" * 40)
                result.pop("desktopClient")
                with self.assertRaisesRegex(ValueError, "desktopClient.*Helm environment"):
                    render.origins(result, environment, "a" * 40)

    def test_environment_requires_one_explicit_boolean_desktop_value(self):
        for text in ("environment: production\n", "desktopClient: null\n",
                     'desktopClient: "true"\n', "desktopClient: true\ndesktopClient: false\n"):
            with self.subTest(text=text), patch.object(Path, "read_text", return_value=text):
                with self.assertRaisesRegex(ValueError, "desktopClient.*boolean"):
                    render.desktop_client("production")

    def test_release_build_makes_the_same_three_archives_for_every_environment(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            scripts = root / "infra/scripts"
            scripts.mkdir(parents=True)
            (scripts / "build-release.sh").write_text(
                (ROOT / "infra/scripts/build-release.sh").read_text())
            for name in ("api", "catalogue"):
                (scripts / f"build-{name}.sh").write_text(
                    f"#!/usr/bin/env bash\necho {name} >> \"$MKC_TEST_BUILD_CALLS\"\n")
            (scripts / "build-app.sh").write_text(
                "#!/usr/bin/env bash\necho app >> \"$MKC_TEST_BUILD_CALLS\"\n"
                "mkdir -p .context/images; touch .context/images/app.tar\n")
            (scripts / "render-values.py").write_text(
                "#!/usr/bin/env python3\nprint('https://api.example.com\\nhttps://example.com')\n")
            calls = root / "calls"
            variables = dict(os.environ, MKC_DOMAIN="example.com",
                             MKC_CATALOGUE_BASE_DOMAIN="catalogues.net",
                             MKC_TEST_BUILD_CALLS=str(calls))
            for environments, expected in [
                (["main-preview"], ["api", "catalogue", "app"]),
                (["main-preview", "preview-pr-42"], ["api", "catalogue", "app", "app"]),
            ]:
                calls.unlink(missing_ok=True)
                result = subprocess.run(["bash", str(scripts / "build-release.sh"), *environments],
                                        env=variables, capture_output=True, text=True, timeout=15)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(calls.read_text().splitlines(), expected)
                self.assertEqual(sorted(path.name for path in (root / ".context/images").iterdir()),
                                 sorted(f"app-{environment}.tar" for environment in environments))
            calls.unlink()
            result = subprocess.run(["bash", str(scripts / "build-release.sh"), "invalid"],
                                    env=variables, capture_output=True, text=True, timeout=15)
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse(calls.exists())

    def test_every_provider_workflow_declares_environment_inputs(self):
        for workflow in ("ci", "deploy", "preview"):
            text = (ROOT / f".github/workflows/{workflow}.yml").read_text()
            for name in ("MKC_CATALOGUE_BASE_DOMAIN", "MKC_CATALOGUE_CLOUDFLARE_ZONE_ID"):
                self.assertIn(name + ": ${{ vars." + name + " }}", text, workflow)
            if workflow != "preview":
                self.assertIn("MKC_NOTIFICATION_CHANNELS: ${{ vars.MKC_NOTIFICATION_CHANNELS }}", text)

    def inputs(self):
        image = "us-central1-docker.pkg.dev/mokly-508518/mokly/fixture@sha256:" + "a" * 64
        return dict(MKC_DOMAIN="example.com", MKC_CATALOGUE_BASE_DOMAIN="catalogues.net",
            MKC_REGION="us-central1", MKC_REVISION="a" * 40,
            MKC_PREVIEW_INGRESS_IP="192.0.2.42",
            MKC_PREVIEW_BLOBS_BUCKET="mokly-508518-preview-blobs",
            MKC_INGRESS_IP="192.0.2.1", MKC_API_IMAGE=image, MKC_APP_IMAGE=image, MKC_CATALOGUE_IMAGE=image)

    def test_pr_values_select_namespace_resources_and_the_toolchain_pin(self):
        result = render.values("preview-pr-42", self.inputs())
        pins = json.loads((ROOT / "infra/toolchains.json").read_text())
        self.assertEqual(result["database"], {"mode": "namespace"})
        self.assertEqual(result["postgres"]["image"], pins["postgres_image"])
        self.assertEqual(result["preview"], {
            "blobsBucket": "mokly-508518-preview-blobs",
            "signInEmail": "preview@mokly.ai",
        })
        self.assertEqual(result["scaling"], {"minReplicas": 1, "maxReplicas": 1})
        self.assertEqual(result["pdb"], {"enabled": False})
        self.assertEqual(result["api"]["trustedProxyHops"], 2)
        self.assertEqual(result["api"]["trustedProxyCidrs"], ["10.24.0.0/14"])
        self.assertEqual(result["catalogue"]["env"]["MKC_GCS_PREFIX"], "pr-42")
        self.assertEqual(result["catalogue"]["env"]["MKC_GCS_BUCKET"], "mokly-508518-preview-blobs")
        for environment in ("production", "main-preview"):
            stable = render.values(environment, self.inputs())
            self.assertNotIn("MKC_GCS_PREFIX", stable["catalogue"]["env"])
            self.assertEqual(stable["catalogue"]["env"]["MKC_GCS_BUCKET"],
                             f"mokly-508518-{environment}-blobs")
            self.assertNotIn("preview", stable)

    def test_preview_deploy_uses_reviewed_values_overlay_and_exact_waits(self):
        script = (ROOT / "infra/scripts/preview-deploy.sh").read_text()
        self.assertIn("bash infra/scripts/preview-platform-ready.sh", script)
        self.assertIn(".context/release-values.json", script)
        self.assertIn('"$chart/environments/preview-pr.yaml"', script)
        self.assertIn("--wait --timeout 15m", script)
        self.assertIn("certificate/catalogue-tls --timeout=900s", script)
        self.assertIn("MKC_SMOKE_TIMEOUT_SECONDS=900", script)
        self.assertIn("MKC_SMOKE_TIMEOUT_SECONDS=60", script)

    def test_pr_renderer_output_is_a_complete_helm_values_file(self):
        with tempfile.TemporaryDirectory() as directory:
            values = Path(directory) / "values.json"
            values.write_text(json.dumps(render.values("preview-pr-42", self.inputs())))
            result = subprocess.run([
                "helm", "template", "mokly-cloud", str(ROOT / "infra/helm/mokly-cloud"),
                "--namespace", "mkc-preview-pr-42", "--kube-version", "1.35.0", "-f", str(values),
            ], capture_output=True, text=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("kind: StatefulSet", result.stdout)
        self.assertIn("ingressClassName: mkc-preview", result.stdout)
        self.assertIn('value: "mokly-508518-preview-blobs"', result.stdout)
        self.assertNotIn("cloud-sql-proxy", result.stdout)
        self.assertNotIn("kind: HorizontalPodAutoscaler", result.stdout)

    def test_pr_ingress_ignores_stable_addresses_and_the_stable_map(self):
        for addresses in ("invalid JSON", json.dumps({"preview-pr-42": "192.0.2.99"})):
            result = render.values("preview-pr-42", dict(self.inputs(), MKC_INGRESS_IPS=addresses))
            self.assertEqual(result["ingressAddress"], "192.0.2.42")

    def test_pr_ingress_requires_its_own_valid_ipv4(self):
        inputs = self.inputs()
        inputs.pop("MKC_PREVIEW_INGRESS_IP")
        inputs["MKC_INGRESS_IPS"] = json.dumps({"preview-pr-42": "192.0.2.99"})
        with self.assertRaisesRegex(ValueError, "MKC_PREVIEW_INGRESS_IP"):
            render.values("preview-pr-42", inputs)
        for address in (None, True, 123, "", "invalid", "192.0.2.999", "2001:db8::1"):
            with self.subTest(address=address), self.assertRaisesRegex(ValueError, "MKC_PREVIEW_INGRESS_IP"):
                render.values("preview-pr-42", dict(inputs, MKC_PREVIEW_INGRESS_IP=address))

    def test_pr_bucket_must_be_the_shared_foundation_bucket(self):
        inputs = self.inputs()
        inputs.pop("MKC_PREVIEW_BLOBS_BUCKET")
        with self.assertRaisesRegex(ValueError, "MKC_PREVIEW_BLOBS_BUCKET"):
            render.values("preview-pr-42", inputs)
        for bucket in (None, True, "", "mokly-508518-preview-pr-42-blobs", "different-bucket"):
            with self.subTest(bucket=bucket), self.assertRaisesRegex(ValueError, "MKC_PREVIEW_BLOBS_BUCKET"):
                render.values("preview-pr-42", dict(inputs, MKC_PREVIEW_BLOBS_BUCKET=bucket))

    def test_pr_runtime_assertions_cover_both_bucket_and_prefix(self):
        storage = {"MKC_GCS_BUCKET": "mokly-508518-preview-blobs", "MKC_GCS_PREFIX": "pr-42"}
        result = render.values("preview-pr-42", dict(
            self.inputs(), MKC_CATALOGUE_CONFIG=json.dumps({"env": storage})))
        self.assertEqual({key: result["catalogue"]["env"][key] for key in storage}, storage)
        for workload in ("APP", "CATALOGUE"):
            for env in ({"MKC_GCS_BUCKET": "wrong"}, {"MKC_GCS_PREFIX": "pr-43"},
                        {"MKC_GCS_PREFIX": ""}, {"MKC_DATABASE_URL": "postgres://wrong"},
                        {"MKC_CATALOGUE_SIGNING_KEY": "never-render"}):
                with self.subTest(workload=workload, env=env), self.assertRaisesRegex(ValueError, "Runtime env"):
                    render.values("preview-pr-42", dict(
                        self.inputs(), **{f"MKC_{workload}_CONFIG": json.dumps({"env": env})}))

    def test_pr_rejects_enabled_github_configuration(self):
        config = {"github": {"enabled": True, "appId": "123", "clientId": "Iv1.fixture", "appSlug": "mokly"}}
        with self.assertRaisesRegex(ValueError, "PR.*GitHub"):
            render.values("preview-pr-42", dict(self.inputs(), MKC_APP_CONFIG=json.dumps(config)))

    def test_each_environment_derives_exact_origins(self):
        cases = [
            ("production", "https://example.com", "https://api.example.com",
             "app-origin.example.com", "catalogues.net"),
            ("main-preview", "https://br-main.preview.example.com",
             "https://br-main.preview.api.example.com",
             "app-origin-main-preview.example.com", "br-main.preview.catalogues.net"),
            ("preview-pr-42", "https://pr-42.preview.example.com",
             "https://pr-42.preview.api.example.com",
             "app-origin-pr-42.preview.example.com", "pr-42.preview.catalogues.net"),
        ]
        for environment, app, api, internal_app, catalogue in cases:
            result = render.values(environment, self.inputs())
            self.assertEqual(result["app"]["env"]["EXPO_PUBLIC_MKC_APP_ORIGIN"], app)
            self.assertEqual(result["app"]["env"]["EXPO_PUBLIC_MKC_API_ORIGIN"], api)
            self.assertEqual(result["catalogue"]["env"]["MKC_APP_ORIGIN"], app)
            self.assertEqual(result["catalogue"]["env"]["MKC_CATALOGUE_ORIGIN"], f"https://{catalogue}")
            self.assertEqual(
                render.origins(result, environment, "a" * 40),
                (api, app, catalogue, "us-central1", internal_app,
                 str(result["desktopClient"]).lower()),
            )
            self.assertEqual(
                render.domain_layout(environment, "example.com"),
                (api, app, internal_app),
            )
            self.assertTrue(all(result[name]["enabled"] for name in ("api", "app", "catalogue")))

    def test_ingress_map_requires_the_requested_environment(self):
        inputs = self.inputs()
        inputs.pop("MKC_INGRESS_IP")
        inputs["MKC_INGRESS_IPS"] = json.dumps({"main-preview": "192.0.2.1"})
        self.assertEqual(render.values("main-preview", inputs)["ingressAddress"], "192.0.2.1")
        with self.assertRaisesRegex(ValueError, "production.*MKC_INGRESS_IPS.*MKC_INGRESS_IP"):
            render.values("production", inputs)

    def test_ingress_map_and_address_errors_name_the_configuration(self):
        inputs = self.inputs()
        inputs.pop("MKC_INGRESS_IP")
        for addresses in ("{", "null", "[]", '"192.0.2.1"'):
            with self.subTest(addresses=addresses), self.assertRaisesRegex(ValueError, "MKC_INGRESS_IPS"):
                render.values("production", dict(inputs, MKC_INGRESS_IPS=addresses))
        for address in (None, True, 123, "", "invalid", "2001:db8::1"):
            with self.subTest(address=address), self.assertRaisesRegex(ValueError, "production.*IPv4"):
                render.values("production", dict(inputs, MKC_INGRESS_IPS=json.dumps({"production": address})))

    def test_explicit_ingress_address_overrides_the_environment_map(self):
        inputs = dict(self.inputs(), MKC_INGRESS_IPS=json.dumps({"production": "192.0.2.2"}))
        self.assertEqual(render.values("production", inputs)["ingressAddress"], "192.0.2.1")

    def test_dns_module_omits_app_and_production_advanced_packs(self):
        source = (ROOT / "infra/terraform/modules/dns/main.tf").read_text()
        self.assertNotIn('resource "cloudflare_certificate_pack" "this"', source)
        self.assertRegex(source, r'count\s+= var\.environment == "main-preview" \? 1 : 0')
        self.assertEqual(render.catalogue_domain("release-preview", "catalogues.net"),
                         "br-release.preview.catalogues.net")

    def test_runtime_config_is_assertions_never_arbitrary_overrides(self):
        for config in [{"env": {"EXPO_PUBLIC_MKC_API_ORIGIN": "https://wrong.invalid"}},
                       {"env": {"SECRET": "never-render"}}, {"env": {"SECRET": None}},
                       {"port": True}, {"port": 80}]:
            with self.assertRaises(ValueError):
                render.values("production", dict(self.inputs(), MKC_APP_CONFIG=json.dumps(config)))
        with self.assertRaises(ValueError):
            render.values("production", dict(self.inputs(), MKC_CATALOGUE_BASE_DOMAIN="example.com"))

    def test_github_app_release_values_are_explicit_and_complete(self):
        disabled = render.values("production", self.inputs())
        self.assertEqual(disabled["github"], {"enabled": False})
        enabled = render.values("production", dict(
            self.inputs(),
            MKC_APP_CONFIG=json.dumps({"github": {"enabled": True, "appId": "123",
                "clientId": "Iv1.fixture", "appSlug": "mokly-test"}})))
        self.assertEqual(enabled["github"]["appSlug"], "mokly-test")
        for config in [
            {"enabled": True, "appId": "123", "clientId": "Iv1.fixture"},
            {"enabled": "true", "appId": "123", "clientId": "Iv1.fixture", "appSlug": "mokly-test"},
            {"enabled": False, "appId": "123"},
            {"enabled": True, "appId": "0", "clientId": "Iv1.fixture", "appSlug": "mokly-test"},
        ]:
            with self.subTest(config=config), self.assertRaises(ValueError):
                render.values("production", dict(
                    self.inputs(), MKC_APP_CONFIG=json.dumps({"github": config})))

    def test_billing_release_values_are_explicit_complete_and_stable_only(self):
        disabled = render.values("production", self.inputs())
        self.assertEqual(disabled["billing"], {"enabled": False})
        enabled_config = {"enabled": True}
        enabled = render.values("production", dict(
            self.inputs(), MKC_APP_CONFIG=json.dumps({"billing": enabled_config})))
        self.assertEqual(enabled["billing"], enabled_config)
        for config in [
            {"enabled": "true"},
            {"enabled": False, "editorPrice": "price_fixtureEditor"},
            {"enabled": True, "collaboratorPrice": "price_fixtureCollab"},
            {},
        ]:
            with self.subTest(config=config), self.assertRaises(ValueError):
                render.values("production", dict(
                    self.inputs(), MKC_APP_CONFIG=json.dumps({"billing": config})))
        with self.assertRaisesRegex(ValueError, "not enabled in PR environments"):
            render.values("preview-pr-42", dict(
                self.inputs(), MKC_APP_CONFIG=json.dumps({"billing": enabled_config})))

    def test_workflows_supply_github_values_in_the_existing_app_config(self):
        deploy = (ROOT / ".github/workflows/deploy.yml").read_text()
        preview = (ROOT / ".github/workflows/preview.yml").read_text()
        self.assertIn("MKC_APP_CONFIG: ${{ vars.MKC_MAIN_PREVIEW_APP_CONFIG }}", deploy)
        self.assertIn("MKC_APP_CONFIG: ${{ vars.MKC_PRODUCTION_APP_CONFIG }}", deploy)
        self.assertIn("MKC_APP_CONFIG: ${{ vars.MKC_APP_CONFIG }}", preview)
        self.assertNotIn("MKC_GITHUB_CONFIG", deploy + preview)
        self.assertNotIn("MKC_SITE_ORIGIN", deploy + preview)

    def test_release_workflows_do_not_supply_removed_app_base_path(self):
        deploy = (ROOT / ".github/workflows/deploy.yml").read_text()
        preview = (ROOT / ".github/workflows/preview.yml").read_text()
        self.assertNotIn("MKC_APP_BASE_PATH", deploy + preview)

    def test_main_deploy_owns_the_shared_origin_router(self):
        deploy = (ROOT / ".github/workflows/deploy.yml").read_text()
        preview = (ROOT / ".github/workflows/preview.yml").read_text()
        self.assertNotIn("CLOUDFLARE_WORKER_API_TOKEN", deploy + preview)
        self.assertIn("GCP_SERVICE_ACCOUNT: ${{ secrets.GCP_DEPLOY_SERVICE_ACCOUNT }}", deploy)
        self.assertIn("CLOUDFLARE_ACCOUNT_ID: ${{ vars.CLOUDFLARE_ACCOUNT_ID }}", deploy)
        self.assertIn("bash infra/scripts/deploy-origin-router.sh", deploy)
        self.assertIn("needs: [publish, origin-router]", deploy)
        self.assertNotIn("wrangler deploy", preview)

    def test_images_include_real_build_and_runtime_contracts(self):
        for workload, entry in [("mkc-api", "entrypoint.sh"), ("mkc-catalogue-server", "catalogue-entrypoint.sh")]:
            docker = (ROOT / f"infra/docker/{workload}.Dockerfile").read_text()
            self.assertIn("ARG RUST_VERSION=1.98.1", docker)
            self.assertIn("USER 65532:65532", docker)
            self.assertIn("STOPSIGNAL SIGINT", docker)
            self.assertIn('CMD ["serve"]', docker)
            self.assertIn(f'exec /usr/local/bin/{workload} "$@"', (ROOT / f"infra/docker/{entry}").read_text())
        entrypoint = (ROOT / "infra/docker/entrypoint.sh").read_text()
        for secret, setting in (("stripe-secret-key", "MKC_STRIPE_SECRET_KEY"),
                                ("stripe-webhook-secret", "MKC_STRIPE_WEBHOOK_SECRET")):
            self.assertIn(f"/var/run/mokly-secrets/{secret}", entrypoint)
            self.assertIn(setting, entrypoint)
        docker = (ROOT / "infra/docker/app.Dockerfile").read_text()
        for contract in ["npm ci", "build:web --workspace @mokly-cloud/app", "EXPO_PUBLIC_MKC_API_ORIGIN",
                         "EXPO_PUBLIC_MKC_APP_ORIGIN", "MKC_CATALOGUE_BASE_DOMAIN",
                         "COPY --from=build /build/apps/app/dist", "COPY --from=build /build/build-config.json",
                         "COPY infra/docker/app-server.mjs", "USER 65532:65532", "STOPSIGNAL SIGINT"]:
            self.assertIn(contract, docker)
        self.assertNotIn("crates/mkc-domain/src/app_paths.rs", docker)
        self.assertNotIn("ARG EXPO_PUBLIC_MKC_SITE_ORIGIN", docker)
        server = (ROOT / "infra/docker/app-server.mjs").read_text()
        self.assertIn('response.setHeader("Content-Security-Policy", contentSecurityPolicy)', server)
        self.assertIn("config.catalogueBaseDomain", server)
        document = (ROOT / "apps/app/public/index.html").read_text()
        self.assertIn('<meta name="robots" content="noindex" />', document)
        for script in ["build-api.sh", "build-catalogue.sh", "build-app.sh"]:
            self.assertIn(script, (ROOT / "infra/scripts/check-image.sh").read_text())

    def test_release_build_validates_baked_domains_before_building(self):
        script = (ROOT / "infra/scripts/build-release.sh").read_text()
        validation = ': "${MKC_CATALOGUE_BASE_DOMAIN:?Supply the catalogue base domain}"'
        self.assertIn(validation, script)
        self.assertLess(script.index(validation), script.index("bash infra/scripts/build-api.sh"))
        self.assertNotIn("MKC_SITE_ORIGIN", script)

    def test_ci_builds_all_workloads_without_cloud_identity(self):
        for workflow in ["deploy", "preview"]:
            text = (ROOT / f".github/workflows/{workflow}.yml").read_text()
            build = text.split("  build:\n", 1)[1].split("\n  publish:" if workflow == "deploy" else "\n  release:", 1)[0]
            self.assertIn("build-release.sh", build)
            self.assertIn("MKC_CATALOGUE_BASE_DOMAIN: ${{ vars.MKC_CATALOGUE_BASE_DOMAIN }}", build)
            self.assertNotIn("id-token: write", build)
            self.assertNotIn("secrets.", build)
            self.assertIn("push-images.sh", text)

    def test_preview_pr_checkouts_never_persist_credentials_or_use_actions_caches(self):
        text = (ROOT / ".github/workflows/preview.yml").read_text()
        revision = "ref: ${{ needs.prepare.outputs.revision }}"
        self.assertEqual(text.count(revision), 2)
        jobs = {
            "build": text.split("  build:\n", 1)[1].split("\n  capture:\n", 1)[0],
            "capture": text.split("  capture:\n", 1)[1].split("\n  release:\n", 1)[0],
        }
        for name, job in jobs.items():
            with self.subTest(job=name):
                checkout = job.split(revision, 1)[1].split("      - name:", 1)[0]
                self.assertIn("persist-credentials: false", checkout)
                for step in job.split("uses: useblacksmith/checkout@")[1:]:
                    checkout = step.split("      - name:", 1)[0]
                    self.assertIn("persist-credentials: false", checkout)
                self.assertNotIn("actions/cache@", job)
                self.assertNotRegex(job, r"(?m)^\s+cache:")
        self.assertIn("fetch-depth: 0", jobs["capture"])
        self.assertIn("package-manager-cache: false", jobs["capture"])

    def test_preview_workflow_keeps_untrusted_code_in_namespace_and_publishes_evidence(self):
        text = (ROOT / ".github/workflows/preview.yml").read_text()
        build = text.split("  build:\n", 1)[1].split("\n  capture:", 1)[0]
        capture = text.split("  capture:\n", 1)[1].split("\n  release:", 1)[0]
        release = text.split("  release:\n", 1)[1].split("\n  required:", 1)[0]
        self.assertIn("path: source/.context/images/*.tar", build)
        self.assertIn("contents: read", build)
        self.assertNotIn("id-token: write", build)
        self.assertNotIn("pull-requests: write", build)
        self.assertIn("capture-catalogue.py", capture)
        self.assertIn("name: seed-catalogue", capture)
        self.assertIn("path: .context/seed/catalogue\n", capture)
        self.assertNotIn("id-token: write", capture)
        self.assertNotIn("secrets.", capture)
        self.assertIn("name: seed-catalogue", release)
        self.assertIn("path: .context/seed/catalogue\n", release)
        self.assertIn("extract-preview", release)
        self.assertIn("::add-mask::", release)
        self.assertIn(".context/seed-status.json", release)
        self.assertIn(".context/seed-proof.json", release)
        self.assertIn("repository_private", text)
        self.assertNotIn("cat $PREVIEW_SECRET_FILE", release)
        for command in ("preview-deploy.sh", "preview-destroy.sh"):
            self.assertIn(command, release)
        for name in ("MKC_PREVIEW_INGRESS_IP", "MKC_PREVIEW_BLOBS_BUCKET",
                     "MKC_CATALOGUE_CLOUDFLARE_ZONE_ID"):
            self.assertIn(f"{name}: ${{{{ vars.{name} }}}}", release)
        for old in ("MKC_INGRESS_IPS", "MKC_NOTIFICATION_CHANNELS", "MKC_STATE_BUCKET"):
            self.assertNotIn(old, release)
        self.assertIn(".context/deployment-smoke.json", release)
        self.assertIn("preview-evidence-pr-${{ github.event.number }}", release)
        self.assertIn("retention-days: 14", release)
        self.assertIn("if-no-files-found: warn", release)
        self.assertIn("pull-requests: write", release)
        self.assertIn("github.paginate(github.rest.issues.listComments", release)
        self.assertIn("comment.user?.type === 'Bot'", release)
        self.assertIn("<!-- mokly-preview -->", release)
        self.assertNotIn("eval(", release)
