"""Evaluate the union of rendered policies, including denied cross-namespace paths."""

import ipaddress

from chart_support import resource


NAMESPACE = "mkc-preview-pr-42"
NAME = "app.kubernetes.io/name"


def selected(selector, labels):
    if any(labels.get(key) != value for key, value in selector.get("matchLabels", {}).items()):
        return False
    for expression in selector.get("matchExpressions", []):
        assert expression["operator"] == "In", "add evaluator support before using a new operator"
        if labels.get(expression["key"]) not in expression["values"]:
            return False
    return True


def peer_matches(peer, labels, namespace, address):
    if "ipBlock" in peer:
        if address is None:
            return False
        ip = ipaddress.ip_address(address)
        block = peer["ipBlock"]
        return ip in ipaddress.ip_network(block["cidr"]) and not any(
            ip in ipaddress.ip_network(cidr) for cidr in block.get("except", []))
    if "namespaceSelector" in peer:
        if not selected(peer["namespaceSelector"], {"kubernetes.io/metadata.name": namespace}):
            return False
    elif "podSelector" in peer and namespace != NAMESPACE:
        return False
    return selected(peer.get("podSelector", {}), labels)


def allows(documents, workload, direction, port, *, peer=None, namespace=NAMESPACE,
           address=None, protocol="TCP", labels=None):
    policies = [doc["spec"] for doc in documents if doc["kind"] == "NetworkPolicy"
                and selected(doc["spec"]["podSelector"], {NAME: workload})
                and direction in doc["spec"]["policyTypes"]]
    if not policies:
        return True
    key = "from" if direction == "Ingress" else "to"
    for policy in policies:
        for rule in policy.get(direction.lower(), []):
            ports = rule.get("ports", [])
            if ports and not any(item.get("protocol", "TCP") == protocol and item["port"] == port
                                 for item in ports):
                continue
            if key not in rule or any(peer_matches(item, labels or {NAME: peer}, namespace, address)
                                      for item in rule[key]):
                return True
    return False


def check_network(documents):
    deny = resource(documents, "NetworkPolicy", "mokly-cloud")["spec"]
    assert deny == {"podSelector": {}, "policyTypes": ["Ingress", "Egress"]}
    for target in ("api", "app", "catalogue"):
        assert allows(documents, target, "Ingress", 8080, peer="controller", namespace="mkc-preview-system")
        assert not allows(documents, target, "Ingress", 9090, peer="controller", namespace="mkc-preview-system")
        for namespace in (NAMESPACE, "mkc-preview-pr-43", "default"):
            for source in ("api", "app", "catalogue", "maintenance", "unknown"):
                expected = namespace == NAMESPACE and target == "api" and source == "catalogue"
                assert allows(documents, target, "Ingress", 8080, peer=source, namespace=namespace) == expected
        assert not allows(documents, target, "Ingress", 8080, address="35.191.0.1")
    for source in ("api", "app", "catalogue", "maintenance", "unknown"):
        expected = source in ("api", "catalogue", "maintenance")
        assert allows(documents, source, "Egress", 5432, peer="postgres") == expected
        assert not allows(documents, source, "Egress", 5432, peer="postgres", namespace="mkc-preview-pr-43")
        assert allows(documents, "postgres", "Ingress", 5432, peer=source) == expected
        assert not allows(documents, "postgres", "Ingress", 5432, peer=source, namespace="mkc-preview-pr-43")
        assert not allows(documents, "postgres", "Ingress", 80, peer=source)
        assert allows(documents, source, "Egress", 8080, peer="api") == (source == "catalogue")
        assert not allows(documents, source, "Egress", 8080, peer="api", namespace="mkc-preview-pr-43")
        assert not allows(documents, source, "Egress", 3307, address="10.30.0.1")
    for name in ("api", "catalogue", "app", "maintenance"):
        for protocol in ("TCP", "UDP"):
            assert allows(documents, name, "Egress", 53, address="169.254.20.10", protocol=protocol)
            assert allows(documents, name, "Egress", 53, namespace="kube-system",
                          labels={"k8s-app": "kube-dns"}, protocol=protocol)
            assert not allows(documents, name, "Egress", 53, namespace="default",
                              labels={"k8s-app": "kube-dns"}, protocol=protocol)
            assert not allows(documents, name, "Egress", 53, namespace="kube-system",
                              labels={"k8s-app": "other"}, protocol=protocol)
        assert allows(documents, name, "Egress", 80, address="169.254.169.254")
        for address in ("8.8.8.8", "2001:4860:4860::8888"):
            assert allows(documents, name, "Egress", 443, address=address)
            assert not allows(documents, name, "Egress", 80, address=address)
        for address in ("10.28.0.1", "10.28.4.151", "172.16.0.1", "192.168.0.1", "169.254.169.254",
                        "169.254.20.10", "127.0.0.1", "100.64.0.1", "fd00::1", "fe80::1"):
            assert not allows(documents, name, "Egress", 443, address=address), (name, address)
    for direction in ("Ingress", "Egress"):
        assert not allows(documents, "unknown", direction, 443, address="8.8.8.8")
    controller = {NAME: "ingress-nginx"}
    for name in ("api", "catalogue", "app", "maintenance", "postgres"):
        assert not allows(documents, name, "Egress", 443, labels=controller, namespace="mkc-preview-system")
