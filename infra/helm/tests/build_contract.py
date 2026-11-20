"""Cloud build settings, secret isolation and rejected chart configurations."""

import difflib
import json

from chart_support import environment, parse_yaml, resource


ENABLED = {
    "enabled": True, "template": "released-build-template", "deploymentId": "fixture-builds",
    "perProcess": 4, "deniedDestinations": ["203.0.113.0/24", "2001:db8::/32"],
}
DISABLED = {"enabled": False, "template": "", "deploymentId": ""}
BUILD_KEYS = {"MKC_E2B_BUILD_TEMPLATE", "MKC_E2B_DEPLOYMENT_ID",
              "MKC_E2B_DENIED_DESTINATIONS", "MKC_BUILDS_PER_PROCESS"}


def check_delivery(rendered, enabled):
    assert all(line == line.rstrip() for line in rendered.splitlines()), "render has trailing whitespace"
    documents = parse_yaml(rendered)
    for name in ("api", "app", "catalogue"):
        deployment = resource(documents, "Deployment", name)
        container = next(item for item in deployment["spec"]["template"]["spec"]["containers"]
                         if item["name"] == name)
        settings = environment(container)
        expected = BUILD_KEYS if name == "api" and enabled else set()
        assert BUILD_KEYS.intersection(settings) == expected
        assert "MKC_E2B_API_KEY" not in settings
        assert "MKC_BUILD_RETENTION_SECONDS" not in settings
        if expected:
            assert settings["MKC_E2B_BUILD_TEMPLATE"] == {"value": ENABLED["template"]}
            assert settings["MKC_E2B_DEPLOYMENT_ID"] == {"value": ENABLED["deploymentId"]}
            assert settings["MKC_E2B_DENIED_DESTINATIONS"] == {"value": ",".join(ENABLED["deniedDestinations"])}
            assert settings["MKC_BUILDS_PER_PROCESS"] == {"value": "4"}
            assert resource(documents, "HorizontalPodAutoscaler", "api")["spec"]["minReplicas"] >= 2
    for document in documents:
        kind = document["kind"]
        if kind == "SecretProviderClass":
            secrets = parse_yaml(document["spec"]["parameters"]["secrets"])[0]
            paths = {item["path"] for item in secrets}
            api_only = document["metadata"]["name"] == "api-secrets" and enabled
            assert ("e2b-api-key" in paths) == api_only
            if api_only:
                secret = next(item for item in secrets if item["path"] == "e2b-api-key")
                assert secret["resourceName"].endswith("-e2b-api-key/versions/latest")
        if kind in ("Job", "CronJob"):
            pod = document["spec"]
            if kind == "CronJob":
                pod = pod["jobTemplate"]["spec"]
            pod = pod["template"]["spec"]
            assert ("volumes" in pod) == (document["metadata"]["name"] == "preview-seed")
            for container in pod["containers"]:
                settings = environment(container)
                assert not BUILD_KEYS.intersection(settings)
                assert "MKC_E2B_API_KEY" not in settings
                if container.get("args") == ["prune"]:
                    assert settings["MKC_BUILD_RETENTION_SECONDS"] == {"value": "2592000"}
                else:
                    assert "MKC_BUILD_RETENTION_SECONDS" not in settings


def check_builds(rendered, options, run, golden, environment_name, update):
    stable = environment_name != "preview-pr"
    check_delivery(rendered, stable)
    if not stable:
        failure = run(["helm", "template", "mokly-cloud", *options,
                       "--set-json", "builds=" + json.dumps(ENABLED)], False)
        assert "PR previews cannot enable builds" in failure, failure
        return
    disabled_options = list(options)
    setting = next(index for index, value in enumerate(options) if value.startswith("builds="))
    del disabled_options[setting - 1:setting + 1]
    disabled = run(["helm", "template", "mokly-cloud", *disabled_options,
                    "--set-json", "builds=" + json.dumps(DISABLED)]).rstrip() + "\n"
    check_delivery(disabled, False)
    path = golden / (environment_name + "-builds-disabled.yaml")
    if update:
        path.write_text(disabled)
    expected = path.read_text()
    assert expected.endswith("\n") and not expected.endswith("\n\n")
    if expected != disabled:
        raise AssertionError("".join(difflib.unified_diff(
            expected.splitlines(True), disabled.splitlines(True), fromfile=str(path), tofile="rendered")))
    rejections = [
        (["--set", "builds.template="], "template"),
        (["--set", "builds.deploymentId="], "deploymentId"),
        (["--set", "builds.enabled=false"], "builds"),
        (["--set", "github.enabled=false,github.appId=,github.clientId=,github.appSlug="], "require GitHub"),
        (["--set", "scaling.minReplicas=1"], "at least two API replicas"),
        (["--set", "scaling.maxReplicas=1"], "maxReplicas"),
    ]
    for value in ("UPPERCASE", "under_score", "with space", "a" * 64):
        rejections.append((["--set-string", "builds.deploymentId=" + value], "deploymentId"))
    for value in (" template", "template ", "template\n"):
        rejections.append((["--set-string", "builds.template=" + value], "surrounding whitespace"))
    for value in (0, 17, -1, 1.5, True, "4"):
        rejections.append((["--set-json", "builds.perProcess=" + json.dumps(value)], "perProcess"))
    for value in (["10.0.0.1"] * 33, [""], [1], ["example.invalid"], ["10.0.0.1/33"],
                  ["::1/129"], ["1::2::3"], ["999.0.0.1"], ["::ffff:999.0.0.1"],
                  ["1:2:3:4:5:6:7::8"], ["1:2:3:4:5:6:7:8:"], ["1::2/24/24"],
                  ["fe80::1%eth0"], ["fe80::1%eth0/64"], ["10.0.0.0/255.255.255.0"],
                  ["10.0.0.1/024"], ["10.0.0.1/000"], ["::1/0064"], ["::1/0000"],
                  ["010.000.000.001"], ["::ffff:192.000.002.001"]):
        rejections.append((["--set-json", "builds.deniedDestinations=" + json.dumps(value)], "deniedDestinations"))
    for value in (-1, 31536001, 1.5, True, "0"):
        rejections.append((["--set-json", "maintenance.buildRetentionSeconds=" + json.dumps(value)], "buildRetentionSeconds"))
    rejections.append((["--set-json", 'builds.apiKey="never-a-chart-secret"'], "additional properties"))
    for change, message in rejections:
        failure = run(["helm", "template", "mokly-cloud", *options, *change], False)
        assert message in failure, failure
    for ceiling in (1, 16):
        tuned = run(["helm", "template", "mokly-cloud", *options,
                     "--set", f"builds.perProcess={ceiling}"])
        api = resource(parse_yaml(tuned), "Deployment", "api")
        assert environment(api["spec"]["template"]["spec"]["containers"][0])["MKC_BUILDS_PER_PROCESS"] == {"value": str(ceiling)}
    minimal = {key: value for key, value in ENABLED.items() if key not in ("perProcess", "deniedDestinations")}
    defaulted = run(["helm", "template", "mokly-cloud", *disabled_options,
                     "--set-json", "builds=" + json.dumps(minimal)])
    api = resource(parse_yaml(defaulted), "Deployment", "api")
    settings = environment(api["spec"]["template"]["spec"]["containers"][0])
    assert settings["MKC_BUILDS_PER_PROCESS"] == {"value": "4"}
    assert "MKC_E2B_DENIED_DESTINATIONS" not in settings
    for entries in ([], ["203.0.113.19/24", " ::1 ", "2001:DB8:1:2:3:4:5:6/64"],
                    ["::", "::ffff:192.0.2.1", "::192.0.2.1", "10.0.0.1/0"], ["10.0.0.1"] * 32,
                    ["10.0.0.1/08", "10.0.0.1/00", "::1/064", "::1/000",
                     "010.000.000.001/24", "::ffff:192.000.002.001/120"]):
        tuned = run(["helm", "template", "mokly-cloud", *options,
                     "--set-json", "builds.deniedDestinations=" + json.dumps(entries)])
        api = resource(parse_yaml(tuned), "Deployment", "api")
        settings = environment(api["spec"]["template"]["spec"]["containers"][0])
        assert ("MKC_E2B_DENIED_DESTINATIONS" in settings) == bool(entries)
        if entries:
            assert settings["MKC_E2B_DENIED_DESTINATIONS"] == {"value": ",".join(entries)}
    for seconds in (0, 31536000):
        tuned = run(["helm", "template", "mokly-cloud", *options,
                     "--set", f"maintenance.buildRetentionSeconds={seconds}"])
        prune = resource(parse_yaml(tuned), "CronJob", "auth-prune")
        container = prune["spec"]["jobTemplate"]["spec"]["template"]["spec"]["containers"][0]
        assert environment(container)["MKC_BUILD_RETENTION_SECONDS"] == {"value": str(seconds)}
    print(f"PASS Helm {environment_name} builds: enabled/disabled goldens, API isolation and runtime bounds")
