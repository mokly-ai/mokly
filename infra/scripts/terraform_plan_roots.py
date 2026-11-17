"""Terraform roots that the destructive-action policy checks."""

from dataclasses import dataclass
from pathlib import Path


ENVIRONMENT = "infra/terraform/environment"
FOUNDATION = "infra/terraform/foundation"
MODULES = "infra/terraform/modules"

# Resources that CI needs to authenticate, read, lock state and apply
# foundation. CI may create and update them but never delete, replace or
# forget them; an entry covers every instance at its address.
FOUNDATION_TRUST = (
    "module.github",
    "google_project_iam_custom_role.foundation_apply",
    "google_project_iam_custom_role.foundation_plan",
    "google_project_iam_member.foundation_apply",
    "google_project_iam_member.foundation_plan",
    "google_project_iam_member.plan",
    "google_storage_bucket_iam_member.state",
    "google_secret_manager_secret.cloudflare_plan",
    "google_secret_manager_secret.cloudflare_foundation",
    "google_secret_manager_secret_iam_member.cloudflare_plan",
    "google_secret_manager_secret_iam_member.cloudflare_foundation",
)


@dataclass(frozen=True)
class Root:
    """One Terraform root instance and the files that its approval binds."""

    name: str
    directory: str
    trust: tuple[str, ...] = ()

    def approval_path(self, repository: Path) -> Path:
        """Return the committed approval document path for this root."""
        return repository / self.directory / "destructive-approvals" / f"{self.name}.json"

    def sources(self, repository: Path) -> list[Path]:
        """Return the directories whose Terraform files the digest covers."""
        return [repository / self.directory, repository / MODULES]

    def trusted(self, address: object) -> bool:
        """Report whether a resource address belongs to the trust set."""
        if not isinstance(address, str):
            return False
        return any(
            address == entry or address.startswith((entry + "[", entry + "."))
            for entry in self.trust
        )


ROOTS = {
    "foundation": Root("foundation", FOUNDATION, FOUNDATION_TRUST),
    "main-preview": Root("main-preview", ENVIRONMENT),
    "production": Root("production", ENVIRONMENT),
}
