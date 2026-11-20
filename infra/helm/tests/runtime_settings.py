"""Keep documented workload settings aligned with rendered Helm environments."""

import re

from chart_support import environment, parse_yaml, resource


ENVIRONMENTS = ("production", "main-preview", "preview-pr")
WORKLOADS = ("api", "app", "catalogue", "maintenance")
TABLE_START = "<!-- workload-settings:start -->"
TABLE_END = "<!-- workload-settings:end -->"
SETTING = re.compile(r"`([A-Z][A-Z0-9_]*)`")
ENV_TARGET = re.compile(r"env:([a-z,]+)@([a-z,-]+)")


class RuntimeSettingsParityError(AssertionError):
    """The documented and rendered workload-setting matrices differ."""


def documented_settings(document):
    """Parse the machine-readable workload-settings table."""
    lines = document.splitlines()
    try:
        start = lines.index(TABLE_START) + 1
        end = lines.index(TABLE_END, start)
    except ValueError as error:
        raise RuntimeSettingsParityError(
            "runtime settings table markers are missing"
        ) from error
    while start < end and not lines[start].strip():
        start += 1
    header = [cell.strip() for cell in lines[start].strip("|").split("|")]
    if header != ["Setting", "Deployment", "Consumer and contract"]:
        raise RuntimeSettingsParityError(
            "runtime settings table is missing the Deployment column"
        )
    settings = {}
    table_lines = lines[start + 2:end]
    while table_lines and not table_lines[-1].strip():
        table_lines.pop()
    for line in table_lines:
        if not line.startswith("|"):
            raise RuntimeSettingsParityError("runtime settings table has an invalid row")
        cells = [cell.strip() for cell in line.strip("|").split("|")]
        if len(cells) != 3:
            raise RuntimeSettingsParityError("runtime settings table has an invalid row")
        names = SETTING.findall(cells[0])
        if not names:
            raise RuntimeSettingsParityError("runtime settings row has no setting")
        targets = set()
        for deployment in re.split(r"`\s*,\s*`", cells[1].strip("`")):
            targets.update(deployment_targets(deployment))
        for name in names:
            if name in settings:
                raise RuntimeSettingsParityError(f"duplicate documented setting: {name}")
            settings[name] = targets
    if not settings:
        raise RuntimeSettingsParityError("runtime settings table is empty")
    return settings


def deployment_targets(deployment):
    """Expand one deployment marker into environment/workload pairs."""
    if deployment in ("local-only", "build-time"):
        return set()
    match = ENV_TARGET.fullmatch(deployment)
    if match is None:
        raise RuntimeSettingsParityError(f"invalid deployment marker: {deployment}")
    workloads = match.group(1).split(",")
    environments = (
        ENVIRONMENTS if match.group(2) == "all" else match.group(2).split(",")
    )
    unknown_workloads = set(workloads) - set(WORKLOADS)
    unknown_environments = set(environments) - set(ENVIRONMENTS)
    if unknown_workloads or unknown_environments:
        raise RuntimeSettingsParityError(f"invalid deployment marker: {deployment}")
    return {(environment_name, workload) for environment_name in environments for workload in workloads}


def rendered_settings(renders):
    """Read workload environment names from one full render per environment."""
    actual = set()
    for environment_name in ENVIRONMENTS:
        documents = parse_yaml(renders[environment_name])
        for workload in WORKLOADS[:-1]:
            deployment = resource(documents, "Deployment", workload)
            containers = deployment["spec"]["template"]["spec"]["containers"]
            container = next(item for item in containers if item["name"] == workload)
            for name in environment(container):
                actual.add((environment_name, workload, name))
        for document in documents:
            if document.get("kind") != "CronJob":
                continue
            workload = "api" if document["metadata"]["name"] == "preview-seed" else "maintenance"
            containers = document["spec"]["jobTemplate"]["spec"]["template"]["spec"]["containers"]
            container = next(item for item in containers if item["name"] == workload)
            for name in environment(container):
                actual.add((environment_name, workload, name))
    return actual


def check_parity(document, actual):
    """Reject documented omissions and undocumented rendered settings."""
    settings = documented_settings(document)
    expected = {
        (environment_name, workload, name)
        for name, targets in settings.items()
        for environment_name, workload in targets
    }
    missing = sorted(expected - actual)
    unexpected = sorted(actual - expected)
    messages = []
    if missing:
        messages.append("documented but unrendered: " + format_settings(missing))
    if unexpected:
        messages.append("rendered but undocumented: " + format_settings(unexpected))
    if messages:
        raise RuntimeSettingsParityError("; ".join(messages))


def check_runtime_settings(document, renders):
    """Check the operations document against complete chart renders."""
    check_parity(document, rendered_settings(renders))


def format_settings(settings):
    """Format matrix entries for a concise failure diagnostic."""
    return ", ".join(f"{environment_name}/{workload}/{name}" for environment_name, workload, name in settings)
