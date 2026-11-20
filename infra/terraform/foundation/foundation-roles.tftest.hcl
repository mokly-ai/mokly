mock_provider "google" {
  mock_resource "google_service_account" {
    defaults = {
      name  = "projects/mokly-508518/serviceAccounts/mkc-fixture@mokly-508518.iam.gserviceaccount.com"
      email = "mkc-fixture@mokly-508518.iam.gserviceaccount.com"
    }
  }
}
override_resource {
  target = module.github.google_service_account.github["plan"]
  values = {
    name  = "projects/mokly-508518/serviceAccounts/mkc-github-plan@mokly-508518.iam.gserviceaccount.com"
    email = "mkc-github-plan@mokly-508518.iam.gserviceaccount.com"
  }
}
override_resource {
  target = module.github.google_service_account.github["foundation"]
  values = {
    name  = "projects/mokly-508518/serviceAccounts/mkc-github-foundation@mokly-508518.iam.gserviceaccount.com"
    email = "mkc-github-foundation@mokly-508518.iam.gserviceaccount.com"
  }
}
mock_provider "cloudflare" {}
variables {
  project       = "mokly-508518"
  region        = "us-central1"
  zone_id       = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  domain        = "example.invalid"
  state_bucket  = "mkc-test-state"
  repository_id = "123456"
  owner_id      = "987654"
  repository    = "mokly-ai/mokly-cloud"
}
run "foundation_identity" {
  command = apply
  assert {
    condition = (
      google_project_iam_custom_role.foundation_apply.project == var.project &&
      google_project_iam_custom_role.foundation_apply.role_id == "mkcFoundationApply" &&
      length(google_project_iam_custom_role.foundation_apply.permissions) == 85 &&
      toset(google_project_iam_custom_role.foundation_apply.permissions) == toset([
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
      ])
    )
    error_message = "The foundation apply role must keep its exact permission list for the resource types this root declares."
  }
  assert {
    condition = (
      google_project_iam_custom_role.foundation_plan.project == var.project &&
      google_project_iam_custom_role.foundation_plan.role_id == "mkcFoundationPlan" &&
      length(google_project_iam_custom_role.foundation_plan.permissions) == 28 &&
      toset(google_project_iam_custom_role.foundation_plan.permissions) == toset([
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
      ])
    )
    error_message = "The foundation plan role must keep its exact read-only permission list."
  }
  assert {
    condition = alltrue([for permission in google_project_iam_custom_role.foundation_plan.permissions :
      contains(["get", "list", "getIamPolicy", "getAttestationRules"], reverse(split(".", permission))[0])
    ])
    error_message = "The foundation plan role may contain only get, list, getIamPolicy and getAttestationRules permissions, never a create, update, delete, set or enable verb."
  }
  assert {
    condition     = length(setsubtract(google_project_iam_custom_role.foundation_plan.permissions, google_project_iam_custom_role.foundation_apply.permissions)) == 0
    error_message = "The foundation plan role may read only resource types that the foundation apply role manages."
  }
  assert {
    condition = (
      google_project_iam_member.foundation_apply.role == google_project_iam_custom_role.foundation_apply.name &&
      google_project_iam_member.foundation_apply.member == "serviceAccount:mkc-github-foundation@mokly-508518.iam.gserviceaccount.com" &&
      length(google_project_iam_member.foundation_apply.condition) == 0 &&
      google_project_iam_member.foundation_plan.role == google_project_iam_custom_role.foundation_plan.name &&
      google_project_iam_member.foundation_plan.member == "serviceAccount:${module.github.emails["plan"]}" &&
      length(google_project_iam_member.foundation_plan.condition) == 0
    )
    error_message = "The foundation apply role belongs to the foundation identity and the foundation plan role to the plan identity."
  }
  assert {
    condition = (
      google_secret_manager_secret.cloudflare_foundation.secret_id == "mkc-cloudflare-foundation-token" &&
      google_secret_manager_secret.cloudflare_foundation.deletion_protection &&
      one(one(google_secret_manager_secret.cloudflare_foundation.replication).user_managed).replicas[0].location == var.region &&
      google_secret_manager_secret_iam_member.cloudflare_foundation.secret_id == google_secret_manager_secret.cloudflare_foundation.secret_id &&
      google_secret_manager_secret_iam_member.cloudflare_foundation.role == "roles/secretmanager.secretAccessor" &&
      google_secret_manager_secret_iam_member.cloudflare_foundation.member == "serviceAccount:mkc-github-foundation@mokly-508518.iam.gserviceaccount.com"
    )
    error_message = "Only the foundation identity may read its dedicated protected Cloudflare token."
  }
  assert {
    condition = (
      length(flatten([for filename in fileset(path.module, "*.tf") : regexall("module[.]github[.]emails\\[\"foundation\"\\]", file("${path.module}/${filename}"))])) == 3 &&
      google_storage_bucket_iam_member.state["foundation"].member == "serviceAccount:mkc-github-foundation@mokly-508518.iam.gserviceaccount.com"
    )
    error_message = "The foundation identity holds exactly its custom role, the state grant and its token grant."
  }
  assert {
    condition     = google_secret_manager_secret.cloudflare_foundation.secret_id != google_secret_manager_secret.cloudflare.secret_id && google_secret_manager_secret.cloudflare_foundation.secret_id != google_secret_manager_secret.cloudflare_apply.secret_id
    error_message = "The foundation identity needs its own Cloudflare token, separate from the operator and environment apply tokens."
  }
}
