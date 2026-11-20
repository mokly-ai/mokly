"""Foundation's CI roles cover exactly the resource types the root declares."""

import re
import unittest

from support import ROOT


FOUNDATION = ROOT / "infra/terraform/foundation"
READ_VERBS = {"get", "list", "getIamPolicy", "getAttestationRules"}
# Calls the Google provider makes for every resource type.
PROVIDER = {"resourcemanager.projects.get", "serviceusage.services.use"}
# The plan identity must not list object names in workload buckets.
PLAN_EXCLUDED = {"storage.objects.list"}
# The Cloudflare token, not a GCP role, authorizes these types.
CLOUDFLARE_TYPES = {
    "cloudflare_certificate_pack",
    "cloudflare_dns_record",
    "cloudflare_zone_setting",
}
WORKLOAD_POOLS = "iam.googleapis.com/workloadIdentityPools"
WORKLOAD_PROVIDERS = "iam.googleapis.com/workloadIdentityPoolProviders"


def crud(prefix, *verbs):
    return {f"{prefix}.{verb}" for verb in verbs}


def iam_policy(prefix):
    return crud(prefix, "getIamPolicy", "setIamPolicy")


# Provider 8.3.0 labels each new address with goog-terraform-provisioned
# through a setLabels call after the create.
PERMISSIONS = {
    "google_artifact_registry_repository": crud(
        "artifactregistry.repositories", "create", "delete", "get", "update"
    ),
    "google_artifact_registry_repository_iam_member": iam_policy(
        "artifactregistry.repositories"
    ),
    "google_compute_address": crud(
        "compute.addresses", "create", "delete", "get", "setLabels"
    )
    | {"compute.regionOperations.get"},
    "google_compute_global_address": crud(
        "compute.globalAddresses",
        "create",
        "createInternal",
        "delete",
        "deleteInternal",
        "get",
        "setLabels",
    )
    | {"compute.globalOperations.get", "compute.networks.use"},
    "google_compute_network": crud("compute.networks", "create", "delete", "get")
    | {"compute.globalOperations.get"},
    "google_compute_router": crud("compute.routers", "create", "delete", "get", "update")
    | {"compute.networks.updatePolicy", "compute.regionOperations.get"},
    "google_compute_router_nat": crud("compute.routers", "get", "update")
    | {"compute.regionOperations.get"},
    "google_compute_subnetwork": crud(
        "compute.subnetworks",
        "create",
        "delete",
        "expandIpCidrRange",
        "get",
        "setPrivateIpGoogleAccess",
        "update",
    )
    | {"compute.networks.updatePolicy", "compute.regionOperations.get"},
    "google_container_cluster": crud(
        "container.clusters", "create", "delete", "get", "update"
    )
    | {"container.operations.get", "iam.serviceAccounts.actAs"},
    # Provider 8.3.0 reads the attestation rules of the pool on every refresh.
    "google_iam_workload_identity_pool": crud(
        WORKLOAD_POOLS,
        "create",
        "delete",
        "get",
        "getAttestationRules",
        "undelete",
        "update",
    ),
    "google_iam_workload_identity_pool_provider": crud(
        WORKLOAD_PROVIDERS, "create", "delete", "get", "undelete", "update"
    ),
    "google_project_iam_custom_role": crud(
        "iam.roles", "create", "delete", "get", "undelete", "update"
    ),
    "google_project_iam_member": iam_policy("resourcemanager.projects"),
    "google_project_service": crud("serviceusage.services", "enable", "get", "list")
    | {"serviceusage.operations.get"},
    "google_secret_manager_secret": crud(
        "secretmanager.secrets", "create", "delete", "get", "update"
    ),
    "google_secret_manager_secret_iam_member": iam_policy("secretmanager.secrets"),
    "google_service_account": crud(
        "iam.serviceAccounts", "create", "delete", "get", "update"
    ),
    "google_service_account_iam_member": iam_policy("iam.serviceAccounts"),
    "google_service_networking_connection": crud(
        "servicenetworking.services", "addPeering", "get"
    )
    | {"compute.networks.use", "servicenetworking.operations.get"},
    "google_storage_bucket": crud("storage.buckets", "create", "delete", "get", "update")
    | {"storage.objects.list"},
    "google_storage_bucket_iam_member": iam_policy("storage.buckets"),
}


def module_directories(directory, seen=None):
    """Return the root and every local module directory it uses, recursively."""
    seen = seen if seen is not None else set()
    directory = directory.resolve()
    if directory in seen:
        return seen
    seen.add(directory)
    for path in sorted(directory.glob("*.tf")):
        for source in re.findall(r'^\s*source\s*=\s*"(\.\.?/[^"]+)"', path.read_text(), re.MULTILINE):
            module_directories(directory / source, seen)
    return seen


def declared_types():
    """Return each resource and data source type the foundation root declares."""
    types = set()
    for directory in module_directories(FOUNDATION):
        for path in sorted(directory.glob("*.tf")):
            text = path.read_text()
            types.update(re.findall(r'^resource\s+"([^"]+)"', text, re.MULTILINE))
            types.update(
                "data." + name for name in re.findall(r'^data\s+"([^"]+)"', text, re.MULTILINE)
            )
    return types


def role_permissions(local_name):
    text = (FOUNDATION / "foundation-roles.tf").read_text()
    match = re.search(rf"\b{local_name}\s*=\s*\[(.*?)\]", text, re.DOTALL)
    if match is None:
        raise AssertionError(f"foundation-roles.tf must define {local_name}")
    return re.findall(r'"([^"]+)"', match[1])


def verb(permission):
    return permission.rsplit(".", 1)[1]


class FoundationPermissionTests(unittest.TestCase):
    def test_every_declared_type_has_a_permission_mapping(self):
        types = declared_types()
        self.assertIn("google_container_cluster", types, "Module discovery must reach gke")
        self.assertIn("google_service_account_iam_member", types)
        unmapped = sorted(types - set(PERMISSIONS) - CLOUDFLARE_TYPES)
        self.assertEqual(
            unmapped,
            [],
            "Add the permissions of each new foundation resource type to "
            "mkcFoundationApply and to this mapping",
        )
        self.assertEqual(
            sorted(set(PERMISSIONS) - types),
            [],
            "Remove the mapping of a resource type that foundation no longer declares",
        )

    def test_apply_role_is_exactly_the_mapped_permissions(self):
        permissions = role_permissions("foundation_apply_permissions")
        self.assertEqual(permissions, sorted(permissions), "Keep the apply list sorted")
        self.assertEqual(len(permissions), len(set(permissions)))
        required = set(PROVIDER).union(
            *(PERMISSIONS[kind] for kind in declared_types() if kind in PERMISSIONS)
        )
        self.assertEqual(sorted(required - set(permissions)), [], "Missing permissions")
        self.assertEqual(sorted(set(permissions) - required), [], "Unmapped permissions")

    def test_plan_role_reads_every_mapped_type_without_object_listing(self):
        apply = set(role_permissions("foundation_apply_permissions"))
        plan = role_permissions("foundation_plan_permissions")
        self.assertEqual(plan, sorted(plan), "Keep the plan list sorted")
        self.assertTrue(all(verb(permission) in READ_VERBS for permission in plan))
        expected = {permission for permission in apply if verb(permission) in READ_VERBS}
        self.assertEqual(set(plan), expected - PLAN_EXCLUDED)


if __name__ == "__main__":
    unittest.main()
