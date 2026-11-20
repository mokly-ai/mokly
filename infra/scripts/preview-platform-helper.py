#!/usr/bin/env python3
"""Validate and inspect the shared preview-platform contract."""

import base64
import ctypes
import ctypes.util
import ipaddress
import json
import os
from pathlib import Path
import re
import sys


CLUSTER_RESOURCES = {
    "ClusterIssuer": "clusterissuers.cert-manager.io",
    "ClusterRole": "clusterroles.rbac.authorization.k8s.io",
    "ClusterRoleBinding": "clusterrolebindings.rbac.authorization.k8s.io",
    "CustomResourceDefinition": "customresourcedefinitions.apiextensions.k8s.io",
    "IngressClass": "ingressclasses.networking.k8s.io",
    "MutatingWebhookConfiguration": (
        "mutatingwebhookconfigurations.admissionregistration.k8s.io"
    ),
    "ValidatingWebhookConfiguration": (
        "validatingwebhookconfigurations.admissionregistration.k8s.io"
    ),
}
DOMAIN_LABEL = re.compile(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?")


def validate_domain(name, value):
    if len(value) > 253 or len(value.split(".")) < 2:
        raise ValueError(f"{name} must be a DNS domain")
    labels = value.split(".")
    if any(not DOMAIN_LABEL.fullmatch(label) for label in labels):
        raise ValueError(f"{name} must be a lowercase DNS domain")
    if not re.fullmatch(r"[a-z]{2,63}", labels[-1]):
        raise ValueError(f"{name} must end in a valid DNS label")


def registrable_domain(value):
    library_name = ctypes.util.find_library("psl")
    if library_name is None:
        raise ValueError("libpsl is required to validate registrable domains")
    library = ctypes.CDLL(library_name)
    library.psl_builtin.restype = ctypes.c_void_p
    library.psl_registrable_domain.argtypes = [ctypes.c_void_p, ctypes.c_char_p]
    library.psl_registrable_domain.restype = ctypes.c_char_p
    result = library.psl_registrable_domain(library.psl_builtin(), value.encode("ascii"))
    if result is None:
        raise ValueError(f"{value} has no ICANN/private-PSL registrable domain")
    return result.decode("ascii")


def validate_inputs(environment):
    required = (
        "MKC_REGION",
        "MKC_PREVIEW_INGRESS_IP",
        "MKC_PREVIEW_BLOBS_BUCKET",
        "MKC_DOMAIN",
        "MKC_CATALOGUE_BASE_DOMAIN",
        "MKC_CATALOGUE_CLOUDFLARE_ZONE_ID",
    )
    missing = [name for name in required if not environment.get(name)]
    if missing:
        raise ValueError("set " + ", ".join(missing))
    if not re.fullmatch(r"[a-z]+-[a-z]+[0-9]+", environment["MKC_REGION"]):
        raise ValueError("MKC_REGION must match [a-z]+-[a-z]+[0-9]+")
    address = environment["MKC_PREVIEW_INGRESS_IP"]
    try:
        parsed_address = ipaddress.IPv4Address(address)
    except ipaddress.AddressValueError as error:
        raise ValueError("MKC_PREVIEW_INGRESS_IP must be IPv4") from error
    if str(parsed_address) != address:
        raise ValueError("MKC_PREVIEW_INGRESS_IP must be canonical IPv4")
    if environment["MKC_PREVIEW_BLOBS_BUCKET"] != "mokly-508518-preview-blobs":
        raise ValueError(
            "MKC_PREVIEW_BLOBS_BUCKET must be mokly-508518-preview-blobs"
        )
    zone_id = environment["MKC_CATALOGUE_CLOUDFLARE_ZONE_ID"]
    if not re.fullmatch(r"[a-f0-9]{32}", zone_id):
        raise ValueError(
            "MKC_CATALOGUE_CLOUDFLARE_ZONE_ID must be 32 lowercase hexadecimal digits"
        )
    app_domain = environment["MKC_DOMAIN"]
    catalogue_domain = environment["MKC_CATALOGUE_BASE_DOMAIN"]
    validate_domain("MKC_DOMAIN", app_domain)
    validate_domain("MKC_CATALOGUE_BASE_DOMAIN", catalogue_domain)
    if registrable_domain(app_domain) == registrable_domain(catalogue_domain):
        raise ValueError("application and catalogue registrable domains must differ")


def cloudflare_cidrs(path):
    lines = Path(path).read_text().splitlines()
    try:
        cloudflare = lines.index("cloudflare:")
        start = lines.index("  trustedProxyCidrs:", cloudflare + 1) + 1
    except ValueError as error:
        raise ValueError("cloudflare.trustedProxyCidrs is missing") from error
    cidrs = []
    for line in lines[start:]:
        match = re.fullmatch(r"    - (\S+)", line)
        if match:
            cidrs.append(match.group(1))
            continue
        if line and not line.startswith("    "):
            break
    if not cidrs:
        raise ValueError("cloudflare.trustedProxyCidrs is empty")
    for cidr in cidrs:
        if str(ipaddress.ip_network(cidr, strict=True)) != cidr:
            raise ValueError(f"invalid Cloudflare CIDR: {cidr}")
    return ",".join(cidrs)


def yaml_documents(text):
    documents = []
    current = []
    for line in text.splitlines():
        if line.strip() == "---":
            if current:
                documents.append(current)
            current = []
        else:
            current.append(line)
    if current:
        documents.append(current)
    return documents


def cluster_inventory(paths):
    inventory = []
    for path in paths:
        for document in yaml_documents(Path(path).read_text()):
            kind = next(
                (line.split(":", 1)[1].strip() for line in document if line.startswith("kind:")),
                None,
            )
            if kind not in CLUSTER_RESOURCES:
                continue
            try:
                metadata = document.index("metadata:")
            except ValueError as error:
                raise ValueError(f"{kind} has no metadata") from error
            name = next(
                (
                    line.split(":", 1)[1].strip().strip("\"'")
                    for line in document[metadata + 1 :]
                    if line.startswith("  name:")
                ),
                None,
            )
            if not name:
                raise ValueError(f"{kind} has no metadata.name")
            inventory.append((kind, name, CLUSTER_RESOURCES[kind]))
    unique = list(dict.fromkeys(inventory))
    if len(unique) != len(inventory):
        raise ValueError("cluster-scoped inventory contains duplicates")
    return unique


def load_json_stdin(expected_kind, expected_name):
    value = json.load(sys.stdin)
    if value.get("kind") != expected_kind:
        raise ValueError(f"expected {expected_kind}/{expected_name}")
    if value.get("metadata", {}).get("name") != expected_name:
        raise ValueError(f"expected {expected_kind}/{expected_name}")
    return value


def validate_secret(name, secret_type, keys, output_directory=None):
    value = load_json_stdin("Secret", name)
    if value.get("type") != secret_type:
        raise ValueError(f"Secret/{name} has the wrong type")
    data = value.get("data", {})
    for key in keys:
        encoded = data.get(key)
        if not isinstance(encoded, str):
            raise ValueError(f"Secret/{name} key {key} is empty")
        try:
            decoded = base64.b64decode(encoded, validate=True)
        except ValueError as error:
            raise ValueError(f"Secret/{name} key {key} is invalid") from error
        if not decoded:
            raise ValueError(f"Secret/{name} key {key} is empty")
        if output_directory is not None:
            with (output_directory / key).open("wb") as output:
                os.fchmod(output.fileno(), 0o600)
                output.write(decoded)


def validate_namespace(name):
    value = load_json_stdin("Namespace", name)
    labels = value.get("metadata", {}).get("labels", {})
    if labels.get("kubernetes.io/metadata.name") != name:
        raise ValueError(f"Namespace/{name} is missing its metadata-name label")


def ingress_class_state(name, controller):
    value = load_json_stdin("IngressClass", name)
    if value.get("spec", {}).get("controller") != controller:
        raise ValueError(f"IngressClass/{name} has the wrong controller")


def issuer_state(name):
    value = load_json_stdin("ClusterIssuer", name)
    conditions = value.get("status", {}).get("conditions", [])
    ready = any(
        condition.get("type") == "Ready" and condition.get("status") == "True"
        for condition in conditions
    )
    print("ready" if ready else "pending")


def service_state(name, expected_address):
    value = load_json_stdin("Service", name)
    ingress = value.get("status", {}).get("loadBalancer", {}).get("ingress", [])
    if not ingress:
        print("pending")
        return
    addresses = [entry.get("ip") for entry in ingress]
    if addresses == [expected_address]:
        print("ready")
    else:
        print("wrong")


def validate_sans(expected):
    lines = [line.strip() for line in sys.stdin if line.strip()]
    if len(lines) < 2 or not lines[0].startswith("X509v3 Subject Alternative Name"):
        raise ValueError("certificate has no subjectAltName extension")
    entries = [entry.strip() for entry in " ".join(lines[1:]).split(",")]
    names = []
    for entry in entries:
        if not entry.startswith("DNS:"):
            raise ValueError("certificate SANs must contain only DNS names")
        names.append(entry.removeprefix("DNS:"))
    if len(names) != 2 or set(names) != set(expected):
        raise ValueError("certificate SANs do not match the preview wildcard hosts")


def run(arguments):
    if not arguments:
        raise ValueError("supply a helper command")
    command, *values = arguments
    if command == "validate-inputs" and not values:
        validate_inputs(dict(os.environ))
    elif command == "cloudflare-cidrs" and len(values) == 1:
        print(cloudflare_cidrs(values[0]))
    elif command == "inventory" and values:
        for item in cluster_inventory(values):
            print("\t".join(item))
    elif command == "secret" and len(values) >= 3:
        validate_secret(values[0], values[1], values[2:])
    elif command == "tls-secret" and len(values) == 1:
        validate_secret(
            "preview-origin-tls", "kubernetes.io/tls", ("tls.key", "tls.crt"), Path(values[0])
        )
    elif command == "namespace" and len(values) == 1:
        validate_namespace(values[0])
    elif command == "ingress-class" and len(values) == 2:
        ingress_class_state(values[0], values[1])
    elif command == "issuer" and len(values) == 1:
        issuer_state(values[0])
    elif command == "service" and len(values) == 2:
        service_state(values[0], values[1])
    elif command == "sans" and len(values) == 2:
        validate_sans(values)
    else:
        raise ValueError(f"invalid arguments for {command}")


def main():
    try:
        run(sys.argv[1:])
    except (ValueError, OSError, json.JSONDecodeError) as error:
        print(f"Preview platform validation failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
