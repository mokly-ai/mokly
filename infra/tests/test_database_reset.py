"""Destructive stable reset hooks run against a disposable PostgreSQL cluster."""

import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import unittest

from support import ROOT

HELM_TESTS = ROOT / "infra/helm/tests"
if str(HELM_TESTS) not in sys.path:
    sys.path.insert(0, str(HELM_TESTS))

import chart_support


class DatabaseResetTests(unittest.TestCase):
    @unittest.skipUnless(
        all(shutil.which(tool) for tool in ("createdb", "dropdb", "helm", "initdb", "pg_isready", "postgres", "psql")),
        "PostgreSQL and Helm tools are required",
    )
    def test_api_reset_and_hooks_erase_rows_then_restore_role_contracts(self):
        documents = self.render_hooks()
        reset = chart_support.resource(documents, "Job", "mokly-cloud-reset-database")
        grants = chart_support.resource(documents, "Job", "mokly-cloud-grant-database")
        reset_script = reset["spec"]["template"]["spec"]["containers"][0]["args"][0]
        grant_script = grants["spec"]["template"]["spec"]["containers"][0]["args"][0]
        with tempfile.TemporaryDirectory(prefix="mkc-reset-") as temporary:
            root = Path(temporary)
            data = root / "data"
            port = self.available_port()
            subprocess.run(
                ["initdb", "-D", data, "--auth=trust", "--username=postgres"],
                check=True,
                capture_output=True,
                text=True,
                timeout=30,
            )
            server = subprocess.Popen(
                ["postgres", "-D", data, "-h", "", "-k", root, "-p", str(port)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            try:
                self.wait_until_ready(root, port)
                environment = dict(os.environ, PGHOST=str(root), PGPORT=str(port), PGSSLMODE="disable")
                self.sql(environment, "postgres", "postgres", self.role_sql())
                subprocess.run(
                    ["createdb", "--maintenance-db=postgres", "--owner=cloudsqlsuperuser", "mokly"],
                    check=True,
                    env=dict(environment, PGUSER="postgres"),
                    timeout=10,
                )
                self.shell(environment, self.reset_role(), reset_script)
                self.sql(
                    environment,
                    self.api_role(),
                    "mokly",
                    "CREATE TABLE old_data (value text); INSERT INTO old_data VALUES ('erase me');",
                )
                self.api_recreate(environment)
                self.shell(environment, self.reset_role(), reset_script)
                self.assertEqual(
                    self.query(environment, self.reset_role(), "mokly", "SELECT to_regclass('public.old_data') IS NULL"),
                    "t",
                )
                self.sql(environment, self.api_role(), "mokly", self.migration_sql())
                self.shell(environment, self.api_role(), grant_script)
                self.assertEqual(
                    self.query(environment, self.catalogue_role(), "mokly", "SELECT value FROM documents"),
                    "visible",
                )
                self.sql(environment, self.catalogue_role(), "mokly", "DELETE FROM catalogue_grants")
                self.sql(
                    environment,
                    self.api_role(),
                    "mokly",
                    "CREATE TABLE future_table (value text); INSERT INTO future_table VALUES ('future');",
                )
                self.assertEqual(
                    self.query(environment, self.catalogue_role(), "mokly", "SELECT value FROM future_table"),
                    "future",
                )
            finally:
                server.terminate()
                server.wait(timeout=10)

    def render_hooks(self):
        digest = "us-central1-docker.pkg.dev/mokly-508518/mokly/fixture@sha256:" + "a" * 64
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json") as values:
            json.dump(
                {
                    "domain": "example.invalid",
                    "catalogueBaseDomain": "catalogues.invalid",
                    "ingressAddress": "192.0.2.1",
                    "revision": "a" * 40,
                    "postmarkFrom": "test@example.invalid",
                    "api": {"image": digest},
                    "app": {"image": digest},
                    "catalogue": {"image": digest},
                },
                values,
            )
            values.flush()
            result = subprocess.run(
                [
                    "helm", "template", "mokly-cloud", "infra/helm/mokly-cloud",
                    "--namespace", "mkc-main-preview",
                    "-f", "infra/helm/mokly-cloud/environments/main-preview.yaml",
                    "-f", values.name,
                    "--set", "resetDatabase=true",
                    "--show-only", "templates/database-reset.yaml",
                ],
                cwd=ROOT,
                check=True,
                capture_output=True,
                text=True,
                timeout=30,
            )
        return chart_support.parse_yaml(result.stdout)

    def available_port(self):
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            return listener.getsockname()[1]

    def wait_until_ready(self, root, port):
        for _ in range(100):
            result = subprocess.run(
                ["pg_isready", "-h", root, "-p", str(port)],
                capture_output=True,
                timeout=2,
            )
            if result.returncode == 0:
                return
            time.sleep(0.05)
        self.fail("disposable PostgreSQL did not become ready")

    def sql(self, environment, user, database, statement):
        subprocess.run(
            ["psql", "-X", "--set=ON_ERROR_STOP=1", "--username=" + user, "--dbname=" + database, "--command=" + statement],
            check=True,
            env=environment,
            capture_output=True,
            text=True,
            timeout=10,
        )

    def query(self, environment, user, database, statement):
        result = subprocess.run(
            ["psql", "-X", "-A", "-t", "--set=ON_ERROR_STOP=1", "--username=" + user, "--dbname=" + database, "--command=" + statement],
            check=True,
            env=environment,
            capture_output=True,
            text=True,
            timeout=10,
        )
        return result.stdout.strip()

    def shell(self, environment, user, script):
        result = subprocess.run(
            ["/bin/sh", "-ceu", script],
            check=True,
            env=dict(environment, PGUSER=user),
            capture_output=True,
            text=True,
            timeout=20,
        )
        self.assertNotIn("WARNING", result.stderr)

    def api_recreate(self, environment):
        authenticated = dict(environment, PGUSER="postgres")
        subprocess.run(
            ["dropdb", "--maintenance-db=postgres", "--force", "mokly"],
            check=True,
            env=authenticated,
            capture_output=True,
            text=True,
            timeout=10,
        )
        subprocess.run(
            ["createdb", "--maintenance-db=postgres", "--owner=cloudsqlsuperuser", "mokly"],
            check=True,
            env=authenticated,
            capture_output=True,
            text=True,
            timeout=10,
        )

    def role_sql(self):
        return (
            'CREATE ROLE cloudsqlsuperuser NOLOGIN CREATEDB CREATEROLE; '
            f'CREATE ROLE "{self.reset_role()}" LOGIN IN ROLE cloudsqlsuperuser; '
            f'CREATE ROLE "{self.api_role()}" LOGIN; '
            f'CREATE ROLE "{self.catalogue_role()}" LOGIN;'
        )

    def migration_sql(self):
        return (
            "CREATE TABLE catalogue_grants (id integer); INSERT INTO catalogue_grants VALUES (1); "
            "CREATE TABLE documents (value text); INSERT INTO documents VALUES ('visible');"
        )

    def api_role(self):
        return "mkc-main-preview-api@mokly-508518.iam"

    def catalogue_role(self):
        return "mkc-main-preview-cat@mokly-508518.iam"

    def reset_role(self):
        return "mkc-main-preview-reset@mokly-508518.iam"


if __name__ == "__main__":
    unittest.main()
