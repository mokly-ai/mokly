locals {
  # Exact permissions for the resource types this root and its modules declare.
  # infra/tests/test_foundation_permissions.py maps each type to its entries.
  # Provider 8.3.0 reads the attestation rules of the identity pool.
  foundation_apply_permissions = [
    "artifactregistry.repositories.create",
    "artifactregistry.repositories.delete",
    "artifactregistry.repositories.get",
    "artifactregistry.repositories.getIamPolicy",
    "artifactregistry.repositories.setIamPolicy",
    "artifactregistry.repositories.update",
    "compute.addresses.create",
    "compute.addresses.delete",
    "compute.addresses.get",
    "compute.addresses.setLabels",
    "compute.globalAddresses.create",
    "compute.globalAddresses.createInternal",
    "compute.globalAddresses.delete",
    "compute.globalAddresses.deleteInternal",
    "compute.globalAddresses.get",
    "compute.globalAddresses.setLabels",
    "compute.globalOperations.get",
    "compute.networks.create",
    "compute.networks.delete",
    "compute.networks.get",
    "compute.networks.updatePolicy",
    "compute.networks.use",
    "compute.regionOperations.get",
    "compute.routers.create",
    "compute.routers.delete",
    "compute.routers.get",
    "compute.routers.update",
    "compute.subnetworks.create",
    "compute.subnetworks.delete",
    "compute.subnetworks.expandIpCidrRange",
    "compute.subnetworks.get",
    "compute.subnetworks.setPrivateIpGoogleAccess",
    "compute.subnetworks.update",
    "container.clusters.create",
    "container.clusters.delete",
    "container.clusters.get",
    "container.clusters.update",
    "container.operations.get",
    "iam.googleapis.com/workloadIdentityPoolProviders.create",
    "iam.googleapis.com/workloadIdentityPoolProviders.delete",
    "iam.googleapis.com/workloadIdentityPoolProviders.get",
    "iam.googleapis.com/workloadIdentityPoolProviders.undelete",
    "iam.googleapis.com/workloadIdentityPoolProviders.update",
    "iam.googleapis.com/workloadIdentityPools.create",
    "iam.googleapis.com/workloadIdentityPools.delete",
    "iam.googleapis.com/workloadIdentityPools.get",
    "iam.googleapis.com/workloadIdentityPools.getAttestationRules",
    "iam.googleapis.com/workloadIdentityPools.undelete",
    "iam.googleapis.com/workloadIdentityPools.update",
    "iam.roles.create",
    "iam.roles.delete",
    "iam.roles.get",
    "iam.roles.undelete",
    "iam.roles.update",
    "iam.serviceAccounts.actAs",
    "iam.serviceAccounts.create",
    "iam.serviceAccounts.delete",
    "iam.serviceAccounts.get",
    "iam.serviceAccounts.getIamPolicy",
    "iam.serviceAccounts.setIamPolicy",
    "iam.serviceAccounts.update",
    "resourcemanager.projects.get",
    "resourcemanager.projects.getIamPolicy",
    "resourcemanager.projects.setIamPolicy",
    "secretmanager.secrets.create",
    "secretmanager.secrets.delete",
    "secretmanager.secrets.get",
    "secretmanager.secrets.getIamPolicy",
    "secretmanager.secrets.setIamPolicy",
    "secretmanager.secrets.update",
    "servicenetworking.operations.get",
    "servicenetworking.services.addPeering",
    "servicenetworking.services.get",
    "serviceusage.operations.get",
    "serviceusage.services.enable",
    "serviceusage.services.get",
    "serviceusage.services.list",
    "serviceusage.services.use",
    "storage.buckets.create",
    "storage.buckets.delete",
    "storage.buckets.get",
    "storage.buckets.getIamPolicy",
    "storage.buckets.setIamPolicy",
    "storage.buckets.update",
    "storage.objects.list",
  ]
  # The plan identity reads every foundation resource but no object listing.
  foundation_plan_permissions = [
    "artifactregistry.repositories.get",
    "artifactregistry.repositories.getIamPolicy",
    "compute.addresses.get",
    "compute.globalAddresses.get",
    "compute.globalOperations.get",
    "compute.networks.get",
    "compute.regionOperations.get",
    "compute.routers.get",
    "compute.subnetworks.get",
    "container.clusters.get",
    "container.operations.get",
    "iam.googleapis.com/workloadIdentityPoolProviders.get",
    "iam.googleapis.com/workloadIdentityPools.get",
    "iam.googleapis.com/workloadIdentityPools.getAttestationRules",
    "iam.roles.get",
    "iam.serviceAccounts.get",
    "iam.serviceAccounts.getIamPolicy",
    "resourcemanager.projects.get",
    "resourcemanager.projects.getIamPolicy",
    "secretmanager.secrets.get",
    "secretmanager.secrets.getIamPolicy",
    "servicenetworking.operations.get",
    "servicenetworking.services.get",
    "serviceusage.operations.get",
    "serviceusage.services.get",
    "serviceusage.services.list",
    "storage.buckets.get",
    "storage.buckets.getIamPolicy",
  ]
}
resource "google_project_iam_custom_role" "foundation_apply" {
  project     = var.project
  role_id     = "mkcFoundationApply"
  title       = "Mokly foundation apply"
  description = "Applies the shared foundation Terraform root from the protected Foundation workflow."
  permissions = local.foundation_apply_permissions
}
resource "google_project_iam_member" "foundation_apply" {
  project = var.project
  role    = google_project_iam_custom_role.foundation_apply.name
  member  = "serviceAccount:${module.github.emails["foundation"]}"
}
resource "google_project_iam_custom_role" "foundation_plan" {
  project     = var.project
  role_id     = "mkcFoundationPlan"
  title       = "Mokly foundation plan"
  description = "Reads the shared foundation resources for the read-only plan."
  permissions = local.foundation_plan_permissions
}
resource "google_project_iam_member" "foundation_plan" {
  project = var.project
  role    = google_project_iam_custom_role.foundation_plan.name
  member  = "serviceAccount:${module.github.emails["plan"]}"
}
resource "google_secret_manager_secret" "cloudflare_foundation" {
  project   = var.project
  secret_id = "mkc-cloudflare-foundation-token"
  replication {
    user_managed {
      replicas { location = var.region }
    }
  }
  deletion_protection = true
  depends_on          = [google_project_service.apis]
}
resource "google_secret_manager_secret_iam_member" "cloudflare_foundation" {
  project   = var.project
  secret_id = google_secret_manager_secret.cloudflare_foundation.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${module.github.emails["foundation"]}"
}
