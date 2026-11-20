"""Validate release inputs and emit Helm values without embedding secret values."""

import ipaddress
import json
import os
import re
import sys
from pathlib import Path

from build_values import builds_config


PINS = Path(__file__).resolve().parents[1] / "toolchains.json"
ENVIRONMENTS = Path(__file__).resolve().parents[1] / "helm/mokly-cloud/environments"
PREVIEW_BUCKET = "mokly-508518-preview-blobs"


def desktop_client(environment):
    """Read the explicit top-level boolean from the checked-in Helm overlay."""
    if not re.fullmatch(r"production|main-preview|preview-pr-[1-9][0-9]{0,8}", environment):
        raise ValueError("Invalid environment")
    name = "preview-pr" if environment.startswith("preview-pr-") else environment
    path = ENVIRONMENTS / (name + ".yaml")
    entries = re.findall(r"^desktopClient:[^\n]*$", path.read_text(), re.MULTILINE)
    match = re.fullmatch(r"desktopClient:[ \t]*(true|false)[ \t]*(?:#.*)?", entries[0]) if len(entries) == 1 else None
    if match is None:
        raise ValueError(f"{path}: desktopClient requires one explicit boolean")
    return match[1] == "true"


def github_config(config):
    if config is None:
        return {"enabled": False}
    allowed = {"enabled", "appId", "clientId", "appSlug"}
    if not isinstance(config, dict) or set(config) - allowed or type(config.get("enabled")) is not bool:
        raise ValueError("GitHub config accepts enabled, appId, clientId and appSlug")
    if not config["enabled"]:
        if set(config) != {"enabled"}:
            raise ValueError("Disabled GitHub config contains no App settings")
        return config
    if set(config) != allowed:
        raise ValueError("Enabled GitHub config requires appId, clientId and appSlug")
    if (not isinstance(config["appId"], str) or not re.fullmatch(r"[1-9][0-9]*", config["appId"])
            or not isinstance(config["clientId"], str) or not config["clientId"]
            or not isinstance(config["appSlug"], str)
            or not re.fullmatch(r"[A-Za-z0-9-]+", config["appSlug"])):
        raise ValueError("Invalid GitHub App identifiers")
    return config


def billing_config(config):
    if config is None:
        return {"enabled": False}
    if (not isinstance(config, dict) or set(config) != {"enabled"}
            or type(config.get("enabled")) is not bool):
        raise ValueError("Billing config accepts exactly enabled as a boolean")
    return config


def ingress_address(environment, variables):
    if environment.startswith("preview-pr-"):
        return ipv4(variables.get("MKC_PREVIEW_INGRESS_IP"),
                    "PR ingress requires MKC_PREVIEW_INGRESS_IP as an IPv4 address")
    try:
        addresses = json.loads(variables.get("MKC_INGRESS_IPS", "{}") or "{}")
    except ValueError as error:
        raise ValueError("MKC_INGRESS_IPS must be a JSON object mapping environments to IPv4 strings") from error
    if not isinstance(addresses, dict):
        raise ValueError("MKC_INGRESS_IPS must be a JSON object mapping environments to IPv4 strings")
    address = variables.get("MKC_INGRESS_IP") or addresses.get(environment)
    diagnostic = (f"{environment} ingress requires a reserved IPv4 address; "
                  f"set MKC_INGRESS_IPS[{environment!r}] or MKC_INGRESS_IP")
    return ipv4(address, diagnostic)


def ipv4(address, diagnostic):
    if not isinstance(address, str) or not address:
        raise ValueError(diagnostic)
    try:
        return str(ipaddress.IPv4Address(address))
    except ValueError as error:
        raise ValueError(diagnostic) from error


def values(environment, variables):
    if not re.fullmatch(r"production|main-preview|preview-pr-[1-9][0-9]{0,8}", environment):
        raise ValueError("Invalid environment")
    result = {"environment": environment, "domain": variables["MKC_DOMAIN"],
              "desktopClient": desktop_client(environment),
              "catalogueBaseDomain": variables["MKC_CATALOGUE_BASE_DOMAIN"],
              "revision": variables["MKC_REVISION"],
              "region": variables["MKC_REGION"],
              "postmarkFrom": variables.get("MKC_POSTMARK_FROM", ""),
              "github": {"enabled": False}, "billing": {"enabled": False},
              "builds": {"enabled": False}}
    result["ingressAddress"] = ingress_address(environment, variables)
    preview = environment.startswith("preview-pr-")
    if preview:
        if variables.get("MKC_PREVIEW_BLOBS_BUCKET") != PREVIEW_BUCKET:
            raise ValueError(f"MKC_PREVIEW_BLOBS_BUCKET must equal {PREVIEW_BUCKET}")
        result.update(environment="preview-pr", prNumber=int(environment.removeprefix("preview-pr-")),
                      database={"mode": "namespace"}, preview={"blobsBucket": PREVIEW_BUCKET,
                                                                "signInEmail": "preview@mokly.ai"},
                      postgres={"image": json.loads(PINS.read_text())["postgres_image"]},
                      scaling={"minReplicas": 1, "maxReplicas": 1}, pdb={"enabled": False})
    api, app, catalogue, _, _, _ = origins(result, environment, variables["MKC_REVISION"])
    expected_env = {
        "app": {"EXPO_PUBLIC_MKC_API_ORIGIN": api, "EXPO_PUBLIC_MKC_APP_ORIGIN": app},
        "catalogue": {"MKC_APP_ORIGIN": app, "MKC_CATALOGUE_ORIGIN": "https://" + catalogue,
                      "MKC_FILE_STORE": "gcs", "MKC_GCS_BUCKET": f"mokly-508518-{environment}-blobs"},
    }
    if preview:
        expected_env["catalogue"].update(MKC_GCS_BUCKET=PREVIEW_BUCKET,
                                         MKC_GCS_PREFIX=f"pr-{result['prNumber']}")
    for workload in ("api", "app", "catalogue"):
        key = "MKC_" + workload.upper() + "_IMAGE"
        image = variables.get(key, "")
        if not re.fullmatch(r"[a-z0-9-]+-docker\.pkg\.dev/mokly-508518/mokly/[a-z0-9_-]+@sha256:[a-f0-9]{64}", image):
            raise ValueError(f"{key} requires a built Artifact Registry digest")
        result[workload] = {"enabled": True, "image": image}
        if workload != "api":
            extra = json.loads(variables.get("MKC_" + workload.upper() + "_CONFIG", "{}") or "{}")
            allowed = {"env", "healthPath", "port"}
            if workload == "app":
                allowed.update(("github", "billing", "builds"))
            if not isinstance(extra, dict) or set(extra) - allowed:
                raise ValueError("Workload config contains unsupported settings")
            if extra.get("healthPath", "/_health") != "/_health":
                raise ValueError("The implemented healthPath is /_health")
            port = extra.get("port", 8080)
            if type(port) is not int or not 1024 <= port <= 65535:
                raise ValueError("Workload port must be an unprivileged integer")
            env = extra.get("env", {})
            if not isinstance(env, dict) or any(
                    k not in expected_env[workload] or expected_env[workload][k] != v
                    for k, v in env.items()):
                raise ValueError("Runtime env must match the release origins and storage; secrets use managed mounts")
            result[workload].update(port=port, healthPath="/_health", env=expected_env[workload])
            if workload == "app":
                result["github"] = github_config(extra.get("github"))
                result["billing"] = billing_config(extra.get("billing"))
                result["builds"] = builds_config(extra.get("builds"))
                if preview and result["builds"]["enabled"]:
                    raise ValueError("PR previews cannot enable builds")
                if result["builds"]["enabled"] and not result["github"]["enabled"]:
                    raise ValueError("Builds require GitHub configuration")
                if preview and result["github"]["enabled"]:
                    raise ValueError("PR previews cannot enable GitHub configuration")
                if preview and result["billing"]["enabled"]:
                    raise ValueError("Billing is not enabled in PR environments")
    if preview:
        result["api"].update(trustedProxyHops=2, trustedProxyCidrs=["10.24.0.0/14"])
    return result


def origins(result, environment, revision):
    actual = result["environment"]
    if actual == "preview-pr":
        actual += "-" + str(result["prNumber"])
    if actual != environment or result["revision"] != revision or not re.fullmatch(r"[a-f0-9]{40}", revision):
        raise ValueError("Reviewed release environment/revision mismatch")
    if result.get("desktopClient") is not desktop_client(environment):
        raise ValueError("Reviewed desktopClient must match the Helm environment boolean")
    domain, catalogue = result["domain"], result["catalogueBaseDomain"]
    for value in (domain, catalogue):
        if not re.fullmatch(r"[a-z0-9][a-z0-9.-]*\.[a-z]+", value):
            raise ValueError("Invalid release domain")
    if domain == catalogue or domain.endswith("." + catalogue) or catalogue.endswith("." + domain):
        raise ValueError("Supply an independent catalogue base domain")
    if not re.fullmatch(r"[a-z]+-[a-z]+[0-9]+", result["region"]):
        raise ValueError("Invalid release region")
    api_origin, app_origin, internal_app_host = domain_layout(environment, domain)
    return (api_origin, app_origin, catalogue_domain(environment, catalogue),
            result["region"], internal_app_host, str(result["desktopClient"]).lower())


def domain_layout(environment, domain):
    if not re.fullmatch(r"production|main-preview|preview-pr-[1-9][0-9]{0,8}", environment):
        raise ValueError("Invalid environment")
    if not re.fullmatch(r"[a-z0-9][a-z0-9.-]*\.[a-z]+", domain):
        raise ValueError("Invalid release domain")
    internal_app_host = "app-origin" + ("" if environment == "production" else "-" + environment) + "." + domain
    if environment == "production":
        app_origin = "https://" + domain
        api_host = "api." + domain
    else:
        label = ("pr-" + environment.removeprefix("preview-pr-")
                 if environment.startswith("preview-pr-")
                 else "br-" + environment.removesuffix("-preview"))
        app_origin = f"https://{label}.preview.{domain}"
        api_host = f"{label}.preview.api.{domain}"
        if environment.startswith("preview-pr-"):
            internal_app_host = f"app-origin-{label}.preview.{domain}"
    return "https://" + api_host, app_origin, internal_app_host


def catalogue_domain(environment, base_domain):
    if environment == "production":
        return base_domain
    if environment.startswith("preview-pr-"):
        label = "pr-" + environment.removeprefix("preview-pr-")
    else:
        label = "br-" + environment.removesuffix("-preview")
    return f"{label}.preview.{base_domain}"


if __name__ == "__main__":
    try:
        if sys.argv[1] == "--domain-layout":
            print("\n".join(domain_layout(sys.argv[2], sys.argv[3])))
        elif sys.argv[1] == "--origins":
            print("\n".join(origins(json.loads(Path(sys.argv[2]).read_text()), sys.argv[3], sys.argv[4])))
        else:
            print(json.dumps(values(sys.argv[1], os.environ), indent=2))
    except (KeyError, ValueError, IndexError) as error:
        sys.exit(str(error))
