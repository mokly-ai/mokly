"""Scheduled cleanup uses only database and storage settings without GitHub."""

import json

from build_contract import DISABLED
from chart_support import environment, parse_yaml


def check_jobs(rendered, environment_name):
    jobs = {document["metadata"]["name"]: document for document in parse_yaml(rendered)}
    expected = {
        "auth-prune": ("prune", {
            "MKC_DATABASE_URL", "MKC_AUTH_LINK_RETENTION_SECONDS",
            "MKC_AUTH_SESSION_RETENTION_SECONDS", "MKC_AUTH_RATE_RETENTION_SECONDS",
            "MKC_BUILD_RETENTION_SECONDS",
        }),
        "github-prune": ("prune-github", {
            "MKC_DATABASE_URL", "MKC_GITHUB_OAUTH_RETENTION_SECONDS",
            "MKC_GITHUB_DELIVERY_RETENTION_SECONDS",
        }),
        "publication-check-status": ("publication-check-status", {"MKC_DATABASE_URL"}),
    }
    if environment_name != "preview-pr":
        expected["billing-delivery-status"] = ("billing-delivery-status", {"MKC_DATABASE_URL"})
        expected["publication-maintenance"] = ("maintain-publications", {
            "MKC_DATABASE_URL", "MKC_ENV", "MKC_FILE_STORE", "MKC_GCS_BUCKET",
        })
    assert set(jobs) == set(expected), (set(jobs), set(expected))
    for name, (command, keys) in expected.items():
        spec = jobs[name]["spec"]
        assert spec["concurrencyPolicy"] == "Forbid"
        pod = spec["jobTemplate"]["spec"]["template"]["spec"]
        assert "volumes" not in pod
        container, = pod["containers"]
        assert container["args"] == [command]
        assert "volumeMounts" not in container
        settings = environment(container)
        assert set(settings) == keys, (name, set(settings), keys)
        if name == "github-prune":
            assert settings["MKC_GITHUB_OAUTH_RETENTION_SECONDS"] == {"value": "86400"}
            assert settings["MKC_GITHUB_DELIVERY_RETENTION_SECONDS"] == {"value": "2592000"}
        if name == "publication-maintenance":
            assert settings["MKC_ENV"] == {"value": "production"}
            assert settings["MKC_FILE_STORE"] == {"value": "gcs"}
            assert settings["MKC_GCS_BUCKET"] == {
                "value": f"mokly-508518-{environment_name}-blobs"
            }


def check_maintenance(rendered, environment_name, options, run):
    check_jobs(rendered, environment_name)
    if environment_name != "preview-pr":
        disabled_options = list(options)
        setting = next(index for index, value in enumerate(options) if value.startswith("builds="))
        del disabled_options[setting - 1:setting + 1]
        disabled = run([
            "helm", "template", "mokly-cloud", *disabled_options,
            "--set-json", "builds=" + json.dumps(DISABLED),
            "--set", "github.enabled=false,github.appId=,github.clientId=,github.appSlug=",
            "--show-only", "templates/maintenance.yaml",
        ])
        check_jobs(disabled, environment_name)
    print(f"PASS Helm {environment_name} maintenance: limited settings, no mounts and GitHub independence")
