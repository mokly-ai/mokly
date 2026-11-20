#!/usr/bin/env python3
"""Run the deployed API preview seed as a namespace Job."""

import argparse
import os
from pathlib import Path
import re
import sys
import time

from preview_lifecycle_core import CommandFailure, preview_parts
from preview_seed_job_cluster import selected_cluster
from preview_seed_job_run import NoSeedStatus, run_seed_job
from preview_seed_job_storage import catalogue_files
from preview_seed_types import Configuration, REVISION, SeedError, validate_evidence


def configuration(arguments, variables):
    number, _, _ = preview_parts(arguments.environment)
    revision = variables.get("MKC_REVISION", "")
    if not REVISION.fullmatch(revision):
        raise SeedError("MKC_REVISION must be a full lowercase Git revision")
    domain = variables.get("MKC_DOMAIN", "")
    label = r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?"
    if not re.fullmatch(label + r"(?:\." + label + r")+", domain):
        raise SeedError("MKC_DOMAIN must be a valid domain")
    return Configuration(
        environment=arguments.environment,
        revision=revision,
        pull_request=int(number),
        app_origin=f"https://pr-{number}.preview.{domain}",
        catalogue=Path(arguments.catalogue or "."),
        status_file=Path(".context/seed-status.json"),
        proof_file=Path(".context/seed-proof.json"),
    )


def parse_arguments(values):
    parser = argparse.ArgumentParser()
    parser.add_argument("environment")
    parser.add_argument("--run")
    parser.add_argument("--catalogue")
    parser.add_argument("--validate-evidence", action="store_true")
    return parser.parse_args(values)


def main(values=None, variables=None, clock=None, sleeper=None):
    variables = os.environ if variables is None else variables
    try:
        arguments = parse_arguments(values)
        settings = configuration(arguments, variables)
        if arguments.validate_evidence:
            validate_evidence(settings)
            print("Preview seed evidence matches the tested revision.")
            return 0
        if not arguments.run or not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,49}", arguments.run):
            raise SeedError("run must match [a-z0-9][a-z0-9-]{0,49}")
        files = catalogue_files(settings.catalogue) if arguments.catalogue else []
        with selected_cluster(settings.environment, variables) as cluster:
            run_seed_job(
                settings, arguments.run, files, cluster,
                clock or time.monotonic, sleeper or time.sleep,
            )
        return 0
    except NoSeedStatus as error:
        print(str(error), file=sys.stderr)
    except (CommandFailure, OSError, ValueError) as error:
        print(f"Preview seed failed: {error}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
