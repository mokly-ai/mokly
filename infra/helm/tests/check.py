"""Pinned Helm lint, complete golden renders and rejected deployment inputs."""

import argparse
import difflib
import json
from pathlib import Path
import subprocess
import tempfile

import chart_support
from build_contract import ENABLED, check_builds
from maintenance_contract import check_maintenance
from namespace_contract import check_namespace, check_preview_seed
from runtime_settings import check_runtime_settings

ROOT = Path(__file__).resolve().parents[3]
CHART = ROOT / "infra/helm/mokly-cloud"
GOLDEN = Path(__file__).parent / "golden"
DIGEST = "us-central1-docker.pkg.dev/mokly-508518/mokly/fixture@sha256:" + "a" * 64


def run(arguments, accepted=True):
    result = subprocess.run(arguments, text=True, capture_output=True, timeout=90)
    if (result.returncode == 0) != accepted:
        raise AssertionError(result.stdout + result.stderr)
    return result.stdout + (result.stderr if not accepted else "")


def check(update=False):
    renders = {}
    with tempfile.TemporaryDirectory() as temporary:
        fixture = Path(temporary) / "values.json"
        fixture.write_text(json.dumps({
            "domain": "example.invalid",
            "catalogueBaseDomain": "catalogues.invalid", "ingressAddress": "192.0.2.1", "revision": "a" * 40,
            "postmarkFrom": "Mokly <mail@example.invalid>",
            "github": {"enabled": True, "appId": "123", "clientId": "Iv1.fixture", "appSlug": "mokly-test"},
            "billing": {"enabled": True},
            "api": {"image": DIGEST},
            "app": {"enabled": True, "image": DIGEST},
            "catalogue": {"enabled": True, "image": DIGEST, "healthPath": "/_health"},
        }))
        for environment in ("production", "main-preview", "preview-pr"):
            namespace = "mkc-" + ("preview-pr-42" if environment == "preview-pr" else environment)
            catalogue_domain = {
                "production": "catalogues.invalid",
                "main-preview": "br-main.preview.catalogues.invalid",
                "preview-pr": "pr-42.preview.catalogues.invalid",
            }[environment]
            options = [str(CHART), "--namespace", namespace, "-f", str(fixture),
                       "-f", str(CHART / "environments" / (environment + ".yaml")),
                       "--set", "prNumber=42", "--kube-version", "1.35.0"]
            if environment == "preview-pr":
                options.extend([
                    "--set",
                    "github.enabled=false,github.appId=,github.clientId=,github.appSlug=",
                    "--set",
                    "billing.enabled=false",
                    "--set", "app.image=" + DIGEST.replace("/fixture@", "/app@"),
                    "--set", "catalogue.image=" + DIGEST.replace("/fixture@", "/catalogue@"),
                ])
            else:
                options.extend(["--set-json", "builds=" + json.dumps(ENABLED)])
            print(run(["helm", "lint", "--strict", *options]), end="")
            rendered = run(["helm", "template", "mokly-cloud", *options]).rstrip() + "\n"
            renders[environment] = rendered
            documents = chart_support.parse_yaml(rendered)
            check_preview_seed(documents, environment)
            check_builds(rendered, options, run, GOLDEN, environment, update)
            api = chart_support.resource(documents, "Deployment", "api")
            catalogue = chart_support.resource(documents, "Deployment", "catalogue")
            api_env = chart_support.environment(api["spec"]["template"]["spec"]["containers"][0])
            catalogue_env = chart_support.environment(
                catalogue["spec"]["template"]["spec"]["containers"][0]
            )
            desktop_client = "false" if environment == "preview-pr" else "true"
            assert api_env["MKC_DESKTOP_CLIENT"] == {"value": desktop_client}
            assert catalogue_env["MKC_DESKTOP_CLIENT"] == {"value": desktop_client}
            assert api_env["MKC_INGEST_WORKERS"] == {"value": "8"}
            assert api_env["MKC_UPLOAD_MEMORY_BYTES"] == {"value": "536870912"}
            assert api_env["MKC_UPLOAD_BLOB_GZIP"] == {"value": "false"}
            assert catalogue_env["MKC_CATALOGUE_HOT_CACHE_BYTES"] == {"value": "134217728"}
            assert "MKC_CATALOGUE_HOT_CACHE_BYTES" not in api_env
            assert "MKC_INGEST_WORKERS" not in catalogue_env
            assert "MKC_UPLOAD_MEMORY_BYTES" not in catalogue_env
            enabled_render = run([
                "helm", "template", "mokly-cloud", *options,
                "--set", "api.uploadBlobGzip=true",
            ])
            enabled_api = chart_support.resource(
                chart_support.parse_yaml(enabled_render), "Deployment", "api"
            )
            enabled_env = chart_support.environment(
                enabled_api["spec"]["template"]["spec"]["containers"][0]
            )
            assert enabled_env["MKC_UPLOAD_BLOB_GZIP"] == {"value": "true"}
            if environment == "production":
                maximum = "9007199254740991"
                tuning = Path(temporary) / "tuning.yaml"
                tuning.write_text(
                    "api:\n"
                    "  ingestWorkers: 32\n"
                    f"  uploadMemoryBytes: {maximum}\n"
                    "catalogue:\n"
                    f"  hotCacheBytes: {maximum}\n"
                )
                tuned = run([
                    "helm", "template", "mokly-cloud", *options,
                    "-f", str(tuning),
                ])
                tuned_documents = chart_support.parse_yaml(tuned)
                tuned_api = chart_support.resource(tuned_documents, "Deployment", "api")
                tuned_catalogue = chart_support.resource(
                    tuned_documents, "Deployment", "catalogue"
                )
                tuned_api_env = chart_support.environment(
                    tuned_api["spec"]["template"]["spec"]["containers"][0]
                )
                tuned_catalogue_env = chart_support.environment(
                    tuned_catalogue["spec"]["template"]["spec"]["containers"][0]
                )
                assert tuned_api_env["MKC_INGEST_WORKERS"] == {"value": "32"}
                assert tuned_api_env["MKC_UPLOAD_MEMORY_BYTES"] == {"value": maximum}
                assert tuned_catalogue_env["MKC_CATALOGUE_HOT_CACHE_BYTES"] == {
                    "value": maximum
                }
            migration = run(["helm", "template", "mokly-cloud", *options,
                             "--show-only", "templates/migration.yaml"]) if environment != "preview-pr" else ""
            for workload in ("api", "app", "catalogue"):
                assert f"app.kubernetes.io/name: {workload} }}" not in migration, (
                    "Migration pods must not match workload Service/PDB selectors")
            bootstrap = run(["helm", "template", "mokly-cloud", *options,
                             "--show-only", "templates/bootstrap.yaml"])
            network = run(["helm", "template", "mokly-cloud", *options,
                           "--show-only", "templates/network-policy.yaml"])
            prerequisites = bootstrap + network
            hooks = 0 if environment == "preview-pr" else 7
            assert prerequisites.count('helm.sh/hook-weight: "-5"') == hooks
            assert prerequisites.count('helm.sh/hook: pre-install,pre-upgrade') == hooks
            assert prerequisites.count('helm.sh/hook-delete-policy: before-hook-creation') == hooks
            assert bootstrap.count('automountServiceAccountToken: false') == (
                3 if environment == "preview-pr" else 4
            )
            assert "meta.helm.sh/release" not in rendered
            assert "app.kubernetes.io/managed-by: Helm" not in prerequisites
            expected_maintenance_jobs = 3 if environment == "preview-pr" else 5
            if environment == "preview-pr":
                check_namespace(rendered)
                assert "postmark" not in rendered.lower()
                assert "value: log" in rendered and "value: preview" in rendered
                assert "MKC_PREVIEW_SIGN_IN_EMAIL" in rendered
                assert "MKC_PREVIEW_SIGN_IN_PLAN" in rendered
                assert "preview-sign-in" in rendered
                assert "value: development" not in rendered
                assert bootstrap.count("kind: SecretProviderClass") == 0
                for setting in ("MKC_GITHUB_APP_ID", "MKC_GITHUB_CLIENT_ID", "MKC_GITHUB_APP_SLUG",
                                "github-client-secret", "github-app-key", "github-webhook-secret",
                                "MKC_BILLING",
                                "stripe-secret-key", "stripe-webhook-secret"):
                    assert setting not in rendered
            else:
                assert "MKC_PREVIEW_SIGN_IN_EMAIL" not in rendered
                assert "MKC_PREVIEW_SIGN_IN_PLAN" not in rendered
                assert "preview-sign-in" not in rendered
                assert 'automountServiceAccountToken: true' not in rendered
                assert 'helm.sh/hook-weight: "0"' in migration
                for kind, count in (("SecretProviderClass", 2), ("BackendConfig", 4),
                                    ("HorizontalPodAutoscaler", 3), ("PodDisruptionBudget", 3), ("Job", 1)):
                    assert rendered.count(f"\nkind: {kind}\n") == count, kind
                assert 'securityPolicy:' in rendered
                assert rendered.count('iam.gke.io/gcp-service-account:') == 3
                assert rendered.count('name: cloud-sql-proxy') == 3 + expected_maintenance_jobs
                assert rendered.count('secretProviderClass:') == 2
                assert 'kubernetes.io/ingress.class: gce' in rendered
                assert 'port: 3307' in rendered
                for kind in ("StatefulSet", "Certificate", "Role", "RoleBinding"):
                    assert f"\nkind: {kind}\n" not in rendered
                assert 'MKC_GCS_PREFIX' not in rendered
                for setting in ("MKC_GITHUB_APP_ID", "MKC_GITHUB_CLIENT_ID", "MKC_GITHUB_APP_SLUG",
                                "github-client-secret", "github-app-key", "github-webhook-secret",
                                "MKC_BILLING",
                                "stripe-secret-key", "stripe-webhook-secret"):
                    assert setting in rendered
                for name, value in (("MKC_BILLING", "stripe"),):
                    assert f"- name: {name}\n              value: {value}" in rendered
                assert 'path: "catalogue-signing-key"' in bootstrap
                assert 'name: MKC_TRUSTED_PROXY_HOPS' in rendered and 'value: "3"' in rendered
                assert '192.0.2.1/32' in rendered
                reset_render = run([
                    "helm", "template", "mokly-cloud", *options,
                    "--set", "resetDatabase=true",
                ])
                assert reset_render.count("name: mokly-cloud-reset-database") == 1
                assert reset_render.count("name: mokly-cloud-grant-database") == 1
                assert reset_render.count("serviceAccountName: reset") == 1
                assert reset_render.count('app.kubernetes.io/name: database-reset') == 4
                assert 'helm.sh/hook-weight: "-1"' in reset_render
                assert 'helm.sh/hook-weight: "1"' in reset_render
                assert "dropdb" not in reset_render
                assert "createdb" not in reset_render
                assert "GRANT CONNECT, CREATE, TEMPORARY ON DATABASE mokly" in reset_render
                assert "GRANT SELECT ON ALL TABLES IN SCHEMA public" in reset_render
                assert "GRANT DELETE ON TABLE public.catalogue_grants" in reset_render
                assert "ALTER DEFAULT PRIVILEGES FOR ROLE" in reset_render
                assert reset_render.count("name: cloud-sql-proxy") == 5 + expected_maintenance_jobs
            for setting in ("MKC_STRIPE_SECRET_KEY", "MKC_STRIPE_WEBHOOK_SECRET", "MKC_STRIPE_API_ORIGIN"):
                assert f"name: {setting}" not in rendered
            assert "MKC_CATALOGUE_SIGNING_KEY" not in rendered
            assert 'MKC_FILE_STORE' in rendered and 'value: gcs' in rendered
            assert f'value: "https://{catalogue_domain}"' in rendered
            assert f'host: "*.{catalogue_domain}"' in rendered
            public_app_origin = {
                "production": "https://example.invalid",
                "main-preview": "https://br-main.preview.example.invalid",
                "preview-pr": "https://pr-42.preview.example.invalid",
            }[environment]
            api_host = {
                "production": "api.example.invalid",
                "main-preview": "br-main.preview.api.example.invalid",
                "preview-pr": "pr-42.preview.api.example.invalid",
            }[environment]
            app_host = {
                "production": "app-origin.example.invalid",
                "main-preview": "app-origin-main-preview.example.invalid",
                "preview-pr": "app-origin-pr-42.preview.example.invalid",
            }[environment]
            expected_app_origin_count = 3 if environment == "main-preview" else 4
            assert rendered.count(f'value: "{public_app_origin}"') == expected_app_origin_count
            assert api_env["MKC_API_ORIGIN"] == {"value": f"https://{api_host}"}
            assert "MKC_API_ORIGIN" not in catalogue_env
            assert f'host: "{api_host}"' in rendered
            assert f'host: "{app_host}"' in rendered
            if environment == "preview-pr":
                assert "MKC_SITE_ORIGIN" not in rendered
            else:
                assert 'name: MKC_SITE_ORIGIN' in rendered
                assert 'value: "https://example.invalid"' in rendered
            assert "EXPO_PUBLIC_MKC_SITE_ORIGIN" not in rendered
            assert 'name: MKC_EXPECTED_REVISION' in rendered
            maintenance = run(["helm", "template", "mokly-cloud", *options,
                               "--show-only", "templates/maintenance.yaml"])
            check_maintenance(maintenance, environment, options, run)
            assert "secretProviderClass" not in migration
            path = GOLDEN / (environment + ".yaml")
            if update:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(rendered)
            expected = path.read_text()
            assert expected.endswith("\n") and not expected.endswith("\n\n"), (
                "Golden files must have exactly one final newline")
            if rendered != expected:
                raise AssertionError("".join(difflib.unified_diff(
                    expected.splitlines(True), rendered.splitlines(True),
                    fromfile=str(path), tofile="rendered")))
            rejections = [
                (["--set", "api.image=example:latest"], "pinned by digest"),
                (["--set", "catalogue.healthPath="], "implemented health path"),
                (["--set", "domain="], "real domain"),
                (["--set", "catalogueBaseDomain=example.invalid"], "independent catalogue"),
                (["--set", "ingressAddress="], "reserved ingress"),
                (["--namespace", "default"], "Namespace must match"),
                (["--set", "environment=preview-pr,prNumber=0"], "Invalid environment"),
                (["--set", "github.enabled=true,github.clientId="], "minLength"),
                (["--set", "maintenance.publicationSchedule="], "minLength"),
                (["--set", "maintenance.publicationSchedule=* * *"], "pattern"),
                (["--set", "maintenance.githubOauthRetentionSeconds=31536001"], "maximum"),
                (["--set", "billing.editorPrice=price_x"], "additional properties"),
                (["--set", "database.mode=invalid"], "must be one of"),
                (["--set", "database.mode=null"], "mode"),
                (["--set", "database=null"], "database"),
                (["--set", "app.env.EXPO_PUBLIC_MKC_API_ORIGIN=https://wrong.invalid"], "Runtime env"),
                (["--set", "catalogue.env.MKC_GCS_BUCKET=wrong"], "Runtime env"),
                (["--set", "catalogue.env.MKC_GCS_PREFIX=pr-43"], "Runtime env"),
                (["--set-string", "desktopClient=true"], "desktopClient"),
                (["--set", "desktopClient=null"], "desktopClient"),
                (["--set-string", "catalogue.env.MKC_DESKTOP_CLIENT=" + ("true" if environment == "preview-pr" else "false")], "Runtime env"),
                (["--set", "api.ingestWorkers=0"], "ingestWorkers"),
                (["--set", "api.ingestWorkers=33"], "ingestWorkers"),
                (["--set-json", "api.ingestWorkers=1.5"], "ingestWorkers"),
                (["--set", "api.uploadMemoryBytes=0"], "uploadMemoryBytes"),
                (["--set-json", "api.uploadMemoryBytes=1.5"], "uploadMemoryBytes"),
                (["--set-json", "api.uploadMemoryBytes=9007199254740992"],
                 "uploadMemoryBytes"),
                (["--set-string", "api.uploadBlobGzip=maybe"], "uploadBlobGzip"),
                (["--set", "catalogue.hotCacheBytes=-1"], "hotCacheBytes"),
                (["--set-json", "catalogue.hotCacheBytes=1.5"], "hotCacheBytes"),
                (["--set-json", "catalogue.hotCacheBytes=9007199254740992"],
                 "hotCacheBytes"),
                (["--set", "database.mode=" + ("cloudsql" if environment == "preview-pr" else "namespace")],
                 "require database.mode="),
            ]
            if environment == "preview-pr":
                rejections.append(([
                    "--set",
                    "billing.enabled=true",
                ], "Billing is not enabled in PR environments"))
            for change, message in rejections:
                failure = run(["helm", "template", "mokly-cloud", *options, *change], False)
                assert message in failure, failure
            if environment == "preview-pr":
                for change, message in [
                    ("github.enabled=true,github.appId=123,github.clientId=Iv1.fixture,github.appSlug=mokly", "PR previews cannot enable GitHub"),
                    ("preview.blobsBucket=wrong", "blobsBucket"),
                    ("preview.signInEmail=", "preview sign-in account"),
                    ("postgres.image=postgres:latest", "image"),
                    ("scaling.maxReplicas=2", "single replicas"),
                    ("pdb.enabled=true", "no PDB"),
                    ("api.trustedProxyHops=3", "two trusted proxy hops"),
                    ("api.trustedProxyHops=2.5", "two trusted proxy hops"),
                    ("api.trustedProxyCidrs[0]=130.211.0.0/22", "pod CIDR"),
                    ("api.port=8081", "api:8080/v1/health"),
                    ("api.port=8080.5", "api:8080/v1/health"),
                    ("api.healthPath=/_health", "api:8080/v1/health"),
                    ("resetDatabase=true", "PR previews reset by deleting their namespace"),
                ]:
                    extra = ["--set-string", "github.appId=123"] if change.startswith("github.") else []
                    flag = "--set-json" if change.endswith(".5") else "--set"
                    failure = run(["helm", "template", "mokly-cloud", *options, flag, change, *extra], False)
                    assert message in failure, failure
            pending = run(["helm", "template", "mokly-cloud", *options,
                           "--set", "app.enabled=false,catalogue.enabled=false"])
            assert pending.count("\nkind: Deployment\n") == 1
            assert rendered.count("\nkind: Deployment\n") == 3
            assert 'args: [migrate]' in rendered and 'kind: NetworkPolicy' in rendered
            if environment != "preview-pr":
                assert 'helm.sh/hook: pre-install,pre-upgrade' in rendered
                assert 'restartPolicy: Always' in rendered
            print(f"PASS Helm {environment}: golden, billing/resource contracts, partial rendering and rejected inputs")
    check_runtime_settings((ROOT / "docs/ops/environment.md").read_text(), renders)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--update", action="store_true")
    check(parser.parse_args().update)
