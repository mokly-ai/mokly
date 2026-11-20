"""Publication fixture and CLI smoke against real API and catalogue child processes."""

from pathlib import Path
import sys
import subprocess

from smoke_support import Api
from publication_smoke_support import Catalogue, files_from_tar, project_and_token
from publication_smoke_uploads import idempotency, plan_rejection, rejections
from publication_smoke_exchange import exchange_matrix, revoked_mid_exchange
from publication_smoke_catalogue import private_access, public_delivery, revoke_access
from publication_smoke_cli import cli_smoke, require_dependencies
from publication_smoke_retention import replay_retained
from publication_smoke_limits import bounded_admission, revoked_in_flight
from publication_smoke_ownership import project_owned_copies
from publication_smoke_desktop import desktop_admission


def failure_checks(api, project, executable):
    """Every authorized rejection that kept its identity reports one failed check."""
    retained = api.sql("SELECT count(*) FROM publications WHERE project_id='" + project["id"] +
                       "' AND state='failed' AND head_sha IS NOT NULL")
    subprocess.run([executable, "--exact", "publication_failure_check_process", "--nocapture"],
                   env=dict(api.environment, MKC_SMOKE_PROCESS="failure-check",
                            MKC_SMOKE_PROJECT_ID=project["id"], MKC_SMOKE_FAILURE_CHECKS=retained),
                   check=True, timeout=30)


def smoke(api, catalogue, executable):
    require_dependencies(Path(__file__).resolve().parents[2])
    fixture = (Path(__file__).parents[2] / "crates/mkc-mokly-contract/fixtures/dogfood.tar.gz").read_bytes()
    files = files_from_tar(fixture)
    owner = api.signup()
    workspace, project, token = project_and_token(api, owner, "Publication fixture")
    try:
        plan_rejection(api, project, token)
        bounded_admission(api, project, token, files)
        revoked_in_flight(api, owner, project, files)
        rejections(api, project, token, files)
        failure_checks(api, project, executable)
        exchange_matrix(api, project, token, files)
        revoked_mid_exchange(api, owner, project, files)
        publication = idempotency(api, project, token, files)
        desktop_admission(api, catalogue, owner, project, publication, executable)
        private_access(api, catalogue, owner, project, publication, files)
        revoke_access(api, catalogue, owner, project, publication)
        public_delivery(api, catalogue, owner, project, publication, files)
        retained = replay_retained(
            api, catalogue, project, token, publication, files, executable)
        primary = {"publication": retained, "project": project, "token": token}
        project_owned_copies(api, catalogue, owner, primary, files, executable)
    finally:
        api.call("DELETE", "/v1/workspaces/" + workspace["id"], {"confirmationName": workspace["name"], "version": 1}, owner, 204)
    assert api.sql("SELECT count(*) FROM publications WHERE project_id='" + project["id"] + "'") == "0"
    assert api.sql("SELECT count(*) FROM blobs b WHERE b.ref_count<>(SELECT count(*) FROM publication_files f WHERE f.project_id=b.project_id AND f.blob_hash=b.hash)") == "0"
    api.sql("DELETE FROM blobs WHERE ref_count=0")
    print("PASS publication cascade deletion keeps blob references consistent")
    cli_smoke(api, catalogue, owner)


if __name__ == "__main__":
    executable = sys.argv[1]
    api = Api(executable, command=[executable, "--exact", "publication_api_process", "--nocapture"], overrides={"MKC_SMOKE_PROCESS": "api", "MKC_DESKTOP_CLIENT": "true"})
    try:
        catalogue = Catalogue(executable, api)
        try:
            smoke(api, catalogue, executable)
        finally:
            catalogue.close()
    finally:
        api.close()
