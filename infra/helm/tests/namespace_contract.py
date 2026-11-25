"""Namespace database, startup, identity and TLS contracts in the rendered chart."""

import json

from chart_support import CHART, ROOT, environment, parse_yaml, resource
from network_contract import check_network


DATABASE_URL = {"valueFrom": {"secretKeyRef": {"name": "postgres-credentials", "key": "url"}}}
SIGNING_SECRET = {"secret": {"name": "catalogue-signing-key", "items": [
    {"key": "catalogue-signing-key", "path": "catalogue-signing-key"}]}}
SECURITY = {"allowPrivilegeEscalation": False, "readOnlyRootFilesystem": True,
            "capabilities": {"drop": ["ALL"]}}


def check_preview_sign_in_rollout_marker(documents, marker):
    for name in ("api", "app", "catalogue"):
        deployment = resource(documents, "Deployment", name)
        pod_metadata = deployment["spec"]["template"]["metadata"]
        actual = pod_metadata.get("annotations", {}).get("mokly.ai/preview-sign-in-rollout-marker")
        expected = marker if name == "api" else None
        assert actual == expected, f"{name} pod rollout marker: expected {expected!r}, got {actual!r}"


def check_preview_seed(documents, environment_name):
    jobs = [doc for doc in documents if doc["kind"] == "CronJob"
            and doc["metadata"]["name"] == "preview-seed"]
    preview = environment_name == "preview-pr"
    assert len(jobs) == int(preview), "preview-seed must render only for PR previews"
    if not preview:
        return
    cron, = jobs
    assert cron["spec"]["suspend"] is True, "preview-seed must stay suspended"
    job = cron["spec"]["jobTemplate"]["spec"]
    assert job["backoffLimit"] == 0
    assert job["activeDeadlineSeconds"] == 1200
    assert job["template"]["metadata"]["labels"] == {"app.kubernetes.io/name": "maintenance"}
    pod = job["template"]["spec"]
    assert pod["restartPolicy"] == "Never"
    assert pod["serviceAccountName"] == "api"
    assert "initContainers" not in pod
    api = resource(documents, "Deployment", "api")["spec"]["template"]["spec"]
    maintenance = resource(documents, "CronJob", "auth-prune")["spec"]["jobTemplate"]["spec"]["template"]["spec"]
    assert pod["securityContext"] == maintenance["securityContext"]
    assert pod["volumes"] == [
        {"name": "tmp", "emptyDir": {"sizeLimit": "64Mi"}},
        {"name": "secrets", "projected": {"sources": [SIGNING_SECRET]}},
    ]
    container, = pod["containers"]
    api_container, = api["containers"]
    maintenance_container, = maintenance["containers"]
    assert container["name"] == "api"
    assert container["args"] == ["preview-seed"]
    assert container["image"] == api_container["image"]
    assert environment(container) == environment(api_container)
    assert container["volumeMounts"] == api_container["volumeMounts"]
    assert container["securityContext"] == maintenance_container["securityContext"]
    assert container["resources"] == maintenance_container["resources"]


def check_namespace(rendered):
    documents = parse_yaml(rendered)
    for forbidden in ("SecretProviderClass", "BackendConfig", "HorizontalPodAutoscaler",
                      "PodDisruptionBudget", "Job", "Secret"):
        assert not any(doc["kind"] == forbidden for doc in documents), forbidden
    for forbidden in ("cloud-sql-proxy", "secretProviderClass", "csi:", "iam.gke.io/",
                      "cloud.google.com/", "kubernetes.io/ingress.", "helm.sh/hook",
                      "postmark", "github-client", "github-app", "github-webhook",
                      "port: 3307", "127.0.0.1:5432"):
        assert forbidden not in rendered, forbidden
    pins = json.loads((ROOT / "infra/toolchains.json").read_text())
    defaults = parse_yaml((CHART / "values.yaml").read_text())[0]
    assert defaults["postgres"]["image"] == pins["postgres_image"]
    check_postgres(documents, pins["postgres_image"])
    check_workloads(documents, defaults, pins["postgres_image"])
    check_ingress(documents)
    check_rbac(documents)
    check_network(documents)
    return documents


def check_postgres(documents, image):
    spec = resource(documents, "StatefulSet", "postgres")["spec"]
    assert spec["serviceName"] == "postgres" and spec["replicas"] == 1
    assert spec["persistentVolumeClaimRetentionPolicy"] == {"whenDeleted": "Retain", "whenScaled": "Retain"}
    assert spec["volumeClaimTemplates"] == [{"metadata": {"name": "data"}, "spec": {
        "accessModes": ["ReadWriteOnce"], "storageClassName": "standard-rwo",
        "resources": {"requests": {"storage": "2Gi"}}}}]
    pod = spec["template"]["spec"]
    assert pod["automountServiceAccountToken"] is False
    assert pod["securityContext"] == {"runAsNonRoot": True, "runAsUser": 999,
        "runAsGroup": 999, "fsGroup": 999, "seccompProfile": {"type": "RuntimeDefault"}}
    assert len(pod["containers"]) == 1
    postgres = pod["containers"][0]
    assert postgres["image"] == image
    assert postgres["securityContext"] == SECURITY
    assert environment(postgres) == {
        "POSTGRES_USER": {"value": "mokly"}, "POSTGRES_DB": {"value": "mokly"},
        "PGDATA": {"value": "/var/lib/postgresql/data/pgdata"},
        "POSTGRES_PASSWORD": {"valueFrom": {"secretKeyRef": {
            "name": "postgres-credentials", "key": "password"}}}}
    assert postgres["resources"] == {"requests": {"cpu": "250m", "memory": "512Mi"},
                                      "limits": {"memory": "1Gi"}}
    assert postgres["volumeMounts"] == [
        {"name": "data", "mountPath": "/var/lib/postgresql/data"},
        {"name": "tmp", "mountPath": "/tmp"}, {"name": "run", "mountPath": "/var/run/postgresql"}]
    assert pod["volumes"] == [{"name": "tmp", "emptyDir": {}}, {"name": "run", "emptyDir": {}}]
    command = {"exec": {"command": ["pg_isready", "-U", "mokly", "-d", "mokly"]}}
    assert postgres["startupProbe"] == dict(command, periodSeconds=5, failureThreshold=60)
    for probe in ("readinessProbe", "livenessProbe"):
        assert postgres[probe] == dict(command, periodSeconds=10, timeoutSeconds=5, failureThreshold=3)
    service = resource(documents, "Service", "postgres")["spec"]
    assert service["type"] == "ClusterIP"
    assert service["selector"] == spec["template"]["metadata"]["labels"]
    assert service["ports"] == [{"name": "postgres", "port": 5432, "targetPort": "postgres"}]


def check_workloads(documents, defaults, postgres_image):
    pods = {}
    for name in ("api", "catalogue", "app"):
        deployment = resource(documents, "Deployment", name)["spec"]
        assert deployment["replicas"] == 1
        pod = deployment["template"]["spec"]
        pods[name] = pod
        assert pod["serviceAccountName"] == name
        for container in [*pod.get("initContainers", []), *pod["containers"]]:
            assert not any(key.startswith("MKC_GITHUB_") for key in environment(container))
        assert resource(documents, "ServiceAccount", name)["automountServiceAccountToken"] is False
        service = resource(documents, "Service", name)
        assert not service["metadata"].get("annotations")
        assert service["spec"]["ports"] == [{"name": "http", "port": 8080, "targetPort": "http"}]
        if name == "app":
            assert "initContainers" not in pod
            continue
        assert len(pod["containers"]) == 1
        container = pod["containers"][0]
        env = environment(container)
        assert env["MKC_DATABASE_URL"] == DATABASE_URL
        assert env["MKC_ENV"] == {"value": "preview"}
        assert env["MKC_GCS_BUCKET"] == {"value": "mokly-508518-preview-blobs"}
        assert env["MKC_GCS_PREFIX"] == {"value": "pr-42"}
        assert {"name": "secrets", "mountPath": "/var/run/mokly-secrets", "readOnly": True} in container["volumeMounts"]
        sources = pod["volumes"][1]["projected"]["sources"]
        preview = {"secret": {"name": "preview-sign-in", "optional": True, "items": [
            {"key": "preview-sign-in", "path": "preview-sign-in"}]}}
        assert sources == ([SIGNING_SECRET, preview] if name == "api" else [SIGNING_SECRET])
    assert resource(documents, "Deployment", "api")["spec"]["strategy"] == {"type": "Recreate"}
    api = pods["api"]["containers"][0]
    env = environment(api)
    assert env["MKC_MAILER"] == {"value": "log"}
    assert env["MKC_PREVIEW_SIGN_IN_EMAIL"] == {"value": "preview@mokly.ai"}
    assert env["MKC_PREVIEW_SIGN_IN_PLAN"] == {"value": "team"}
    assert env["MKC_TRUSTED_PROXY_HOPS"] == {"value": "2"}
    assert env["MKC_TRUSTED_PROXY_CIDRS"]["value"].split(",") == ["10.24.0.0/14", *defaults["cloudflare"]["trustedProxyCidrs"]]
    wait, migrate = pods["api"]["initContainers"]
    assert [wait["name"], migrate["name"]] == ["wait-for-postgres", "migrate"]
    assert wait["image"] == postgres_image
    assert wait["command"] == ["timeout", "300", "bash", "-ec"]
    assert 'pg_isready -d "$MKC_DATABASE_URL"' in wait["args"][0] and "sleep 2" in wait["args"][0]
    assert migrate["image"] == api["image"] and migrate["args"] == ["migrate"]
    for init in (wait, migrate):
        assert environment(init) == {"MKC_DATABASE_URL": DATABASE_URL}
        assert "volumeMounts" not in init and "restartPolicy" not in init
        assert init["securityContext"] == SECURITY
    gate, = pods["catalogue"]["initContainers"]
    assert gate["name"] == "wait-for-api" and gate["image"] == pods["app"]["containers"][0]["image"]
    assert gate["command"] == ["node", "--input-type=module", "-e"]
    assert gate["args"] == [(CHART / "files/wait-for-api.mjs").read_text()]
    assert environment(gate) == {"MKC_EXPECTED_REVISION": {"value": "a" * 40}}
    assert gate["securityContext"] == SECURITY
    for name in ("auth-prune", "github-prune", "publication-check-status"):
        pod = resource(documents, "CronJob", name)["spec"]["jobTemplate"]["spec"]["template"]["spec"]
        assert "initContainers" not in pod and "volumes" not in pod
        container, = pod["containers"]
        assert "volumeMounts" not in container
        assert environment(container)["MKC_DATABASE_URL"] == DATABASE_URL


def check_ingress(documents):
    ingress = resource(documents, "Ingress", "mokly-cloud")
    assert ingress["metadata"]["annotations"] == {
        "nginx.ingress.kubernetes.io/proxy-body-size": "100m",
        "nginx.ingress.kubernetes.io/proxy-read-timeout": "300",
        "nginx.ingress.kubernetes.io/proxy-request-buffering": "off"}
    spec = ingress["spec"]
    assert spec["ingressClassName"] == "mkc-preview"
    hosts = ["pr-42.preview.api.example.invalid", "app-origin-pr-42.preview.example.invalid",
             "*.pr-42.preview.catalogues.invalid"]
    assert spec["tls"] == [{"secretName": "catalogue-tls", "hosts": [hosts[2]]}]
    assert [rule["host"] for rule in spec["rules"]] == hosts
    for rule, name in zip(spec["rules"], ("api", "app", "catalogue")):
        assert rule["http"]["paths"] == [{"path": "/", "pathType": "Prefix", "backend": {
            "service": {"name": name, "port": {"name": "http"}}}}]
    certificate = resource(documents, "Certificate", "catalogue-tls")
    assert certificate["metadata"]["annotations"] == {"helm.sh/resource-policy": "keep"}
    assert certificate["spec"] == {
        "secretName": "catalogue-tls", "dnsNames": [hosts[2]],
        "secretTemplate": {"annotations": {"helm.sh/resource-policy": "keep"}},
        "issuerRef": {"name": "mkc-preview-letsencrypt", "kind": "ClusterIssuer", "group": "cert-manager.io"},
        "privateKey": {"algorithm": "RSA", "size": 2048, "rotationPolicy": "Always"},
        "duration": "2160h", "renewBefore": "720h"}


def check_rbac(documents):
    assert not any(doc["kind"] in ("Role", "RoleBinding") for doc in documents)
    accounts = [doc for doc in documents if doc["kind"] == "ServiceAccount"]
    assert sorted(doc["metadata"]["name"] for doc in accounts) == ["api", "app", "catalogue"]
    assert all(doc["automountServiceAccountToken"] is False for doc in accounts)
