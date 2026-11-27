mock_provider "google" {
  mock_resource "google_service_account" {
    defaults = {
      name  = "projects/mokly-508518/serviceAccounts/mkc-fixture@mokly-508518.iam.gserviceaccount.com"
      email = "mkc-fixture@mokly-508518.iam.gserviceaccount.com"
    }
  }
}
override_resource {
  target = module.github.google_service_account.github["apply"]
  values = {
    name  = "projects/mokly-508518/serviceAccounts/mkc-github-apply@mokly-508518.iam.gserviceaccount.com"
    email = "mkc-github-apply@mokly-508518.iam.gserviceaccount.com"
  }
}
override_resource {
  target = module.github.google_service_account.github["deploy"]
  values = {
    name  = "projects/mokly-508518/serviceAccounts/mkc-github-deploy@mokly-508518.iam.gserviceaccount.com"
    email = "mkc-github-deploy@mokly-508518.iam.gserviceaccount.com"
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
run "topology" {
  command = apply
  assert {
    condition = (
      length(regexall("module\\s+\"identity\"\\s*\\{[^}]*depends_on\\s*=\\s*\\[module[.]gke\\][^}]*\\}", file("${path.module}/environments.tf"))) == 1 &&
      length(regexall("module\\s+\"secrets\"\\s*\\{[^}]*workload_emails\\s*=\\s*module[.]identity\\[each[.]key\\][.]emails", file("${path.module}/environments.tf"))) == 1
    )
    error_message = "Secret access must depend on the environment's Google accounts, which wait for the GKE workload pool."
  }
  assert {
    condition     = length(cloudflare_zone_setting.tls) == 0
    error_message = "Shared-zone SSL is operator opt-in."
  }
  assert {
    condition     = cloudflare_certificate_pack.app_api.zone_id == var.zone_id && cloudflare_certificate_pack.app_api.type == "advanced" && cloudflare_certificate_pack.app_api.hosts == toset(["example.invalid", "*.preview.example.invalid", "*.preview.api.example.invalid"]) && cloudflare_certificate_pack.app_api.validation_method == "txt" && cloudflare_certificate_pack.app_api.validity_days == 90 && cloudflare_certificate_pack.app_api.certificate_authority == "lets_encrypt" && !cloudflare_certificate_pack.app_api.cloudflare_branding
    error_message = "Foundation must own the exact shared app/API advanced certificate pack."
  }
  assert {
    condition     = length(flatten([for filename in fileset(path.module, "*.tf") : regexall("resource\\s+\"cloudflare_workers?_[^\"]+\"", file("${path.module}/${filename}"))])) == 0
    error_message = "Wrangler, not Terraform, must own the Worker script and routes."
  }
  assert {
    condition = alltrue([for role in concat(
      [google_project_iam_member.apply.role],
      [for grant in google_project_iam_member.deploy : grant.role],
      [google_project_iam_member.preview_platform_deploy.role],
      [for grant in google_project_iam_member.database_reset : grant.role],
      [for grant in google_project_iam_member.plan : grant.role],
      [google_project_iam_member.foundation_apply.role, google_project_iam_member.foundation_plan.role],
      [for grant in google_secret_manager_secret_iam_member.deploy_tls : grant.role],
      [for grant in google_secret_manager_secret_iam_member.deploy_catalogue : grant.role],
      [for grant in google_secret_manager_secret_iam_member.deploy_preview : grant.role],
      [google_secret_manager_secret_iam_member.cloudflare_plan.role, google_secret_manager_secret_iam_member.cloudflare_apply.role, google_secret_manager_secret_iam_member.cloudflare_foundation.role, google_secret_manager_secret_iam_member.cloudflare_worker.role, google_artifact_registry_repository_iam_member.writer.role]
    ) : !can(regex("(?i)(^roles/(owner|editor|viewer)$|admin$)", role))])
    error_message = "Apply/deploy/plan/foundation must never gain broad basic, IAM-admin or service-admin roles."
  }
  assert {
    condition     = alltrue([for grant in concat([google_project_iam_member.apply, google_project_iam_member.preview_platform_deploy, google_project_iam_member.foundation_apply, google_project_iam_member.foundation_plan], values(google_project_iam_member.deploy), values(google_project_iam_member.database_reset), values(google_project_iam_member.plan)) : !can(regex("(?i)(^roles/(owner|editor|viewer)$|admin$)", grant.role))])
    error_message = "Project-level CI permissions may not include any admin role, including objectAdmin."
  }
  assert {
    condition     = keys(google_storage_bucket_iam_member.state) == ["apply", "foundation", "plan"] && alltrue([for identity, grant in google_storage_bucket_iam_member.state : grant.member == "serviceAccount:${module.github.emails[identity]}" && grant.role == "roles/storage.objectAdmin" && grant.bucket == var.state_bucket])
    error_message = "Only the plan, apply and foundation identities may access state for locking and exact-plan application."
  }
  assert {
    condition = alltrue([for member in concat(
      [for grant in google_storage_bucket_iam_member.state : grant.member],
      flatten([for storage in module.storage : values(storage.iam_members)])
    ) : member != "serviceAccount:${module.github.emails["deploy"]}"])
    error_message = "Deploy must have no access to stable workload buckets or Terraform state."
  }
  assert {
    condition = toset(flatten([
      for filename in concat(
        tolist(fileset(path.module, "*.tf")),
        [for bootstrap_file in fileset("${path.module}/../bootstrap", "*.tf") : "../bootstrap/${bootstrap_file}"],
        [for environment_file in fileset("${path.module}/../environment", "*.tf") : "../environment/${environment_file}"],
        [for module_file in fileset("${path.module}/../modules", "*/*.tf") : "../modules/${module_file}"]
        ) : [
        for name in flatten(regexall("resource\\s+\"google_storage_bucket_iam_member\"\\s+\"([^\"]+)\"", file("${path.module}/${filename}"))) :
        "${filename}:${name}"
      ]
    ])) == toset(["permissions.tf:state", "preview.tf:deploy_preview", "../modules/storage/main.tf:objects"])
    error_message = "Audit every bucket IAM resource: state, stable workloads and the single preview deploy grant only."
  }
  assert {
    condition = (
      keys(google_project_iam_member.deploy) == ["roles/container.developer"] &&
      google_project_iam_member.deploy["roles/container.developer"].member == "serviceAccount:${module.github.emails["deploy"]}" &&
      length(google_project_iam_member.deploy["roles/container.developer"].condition) == 0
    )
    error_message = "Deploy must have the unconditional container.developer role required by the GKE DNS endpoint and Kubernetes authorizer."
  }
  assert {
    condition = (
      google_project_iam_custom_role.preview_platform_deploy.project == var.project &&
      google_project_iam_custom_role.preview_platform_deploy.role_id == "mkcPreviewPlatformDeploy" &&
      length(google_project_iam_custom_role.preview_platform_deploy.permissions) == 22 &&
      toset(google_project_iam_custom_role.preview_platform_deploy.permissions) == toset([
        "container.clusterRoles.create",
        "container.clusterRoles.update",
        "container.clusterRoles.delete",
        "container.clusterRoles.escalate",
        "container.clusterRoles.bind",
        "container.clusterRoleBindings.create",
        "container.clusterRoleBindings.update",
        "container.clusterRoleBindings.delete",
        "container.roles.create",
        "container.roles.update",
        "container.roles.delete",
        "container.roles.escalate",
        "container.roles.bind",
        "container.roleBindings.create",
        "container.roleBindings.update",
        "container.roleBindings.delete",
        "container.mutatingWebhookConfigurations.create",
        "container.mutatingWebhookConfigurations.update",
        "container.mutatingWebhookConfigurations.delete",
        "container.validatingWebhookConfigurations.create",
        "container.validatingWebhookConfigurations.update",
        "container.validatingWebhookConfigurations.delete",
      ])
    )
    error_message = "Preview deploy must receive exactly the missing RBAC and webhook permissions, including escalation and binding."
  }
  assert {
    condition = (
      google_project_iam_member.preview_platform_deploy.project == var.project &&
      google_project_iam_member.preview_platform_deploy.role == google_project_iam_custom_role.preview_platform_deploy.name &&
      google_project_iam_member.preview_platform_deploy.member == "serviceAccount:${module.github.emails["deploy"]}" &&
      length(google_project_iam_member.preview_platform_deploy.condition) == 0
    )
    error_message = "Only the deploy service account may receive the project-level preview platform role."
  }
  assert {
    condition = (
      toset([for grant in google_secret_manager_secret_iam_member.deploy_tls : grant.secret_id]) == toset([
        "mkc-main-preview-origin-tls-cert",
        "mkc-main-preview-origin-tls-key",
        "mkc-production-origin-tls-cert",
        "mkc-production-origin-tls-key",
      ]) &&
      toset([for grant in google_secret_manager_secret_iam_member.deploy_catalogue : grant.secret_id]) == toset([
        "mkc-main-preview-stripe-catalogue-key",
        "mkc-production-stripe-catalogue-key",
      ]) &&
      alltrue([for grant in concat(
        values(google_secret_manager_secret_iam_member.deploy_tls),
        values(google_secret_manager_secret_iam_member.deploy_catalogue),
        ) :
        grant.role == "roles/secretmanager.secretAccessor" &&
        grant.member == "serviceAccount:${module.github.emails["deploy"]}"
      ])
    )
    error_message = "Stable deploy grants must be exactly four ingress TLS grants and two deploy-only catalogue-key grants."
  }
  assert {
    condition     = length(google_project_iam_member.sql) == 12 && alltrue([for grant in google_project_iam_member.sql : length(grant.condition) == 1])
    error_message = "Foundation must own scoped workload SQL IAM."
  }
  assert {
    condition = (
      google_project_iam_custom_role.stable_database_reset.project == var.project &&
      google_project_iam_custom_role.stable_database_reset.role_id == "mkcStableDatabaseReset" &&
      toset(google_project_iam_custom_role.stable_database_reset.permissions) == toset([
        "cloudsql.databases.create",
        "cloudsql.databases.delete",
        "cloudsql.databases.list",
      ]) &&
      length(google_project_iam_member.database_reset) == 2 &&
      alltrue([for environment, grant in google_project_iam_member.database_reset :
        grant.role == google_project_iam_custom_role.stable_database_reset.name &&
        grant.member == "serviceAccount:${module.identity[environment].emails["reset"]}" &&
        length(grant.condition) == 0
      ])
    )
    error_message = "Each reset identity recreates its stable database through the Cloud SQL Admin API without an IAM condition, because a condition denies every Cloud SQL database operation."
  }
  assert {
    condition = (
      length(google_service_account_iam_member.deploy_database_reset) == 2 &&
      alltrue([for environment, grant in google_service_account_iam_member.deploy_database_reset :
        grant.service_account_id == "projects/${var.project}/serviceAccounts/${module.identity[environment].emails["reset"]}" &&
        grant.role == "roles/iam.serviceAccountTokenCreator" &&
        grant.member == "serviceAccount:${module.github.emails["deploy"]}"
      ])
    )
    error_message = "Deploy may impersonate only the two dedicated reset identities for explicit database resets."
  }
  assert {
    condition     = length(google_artifact_registry_repository.images.cleanup_policies) == 2
    error_message = "Preview cleanup and stable release retention are required."
  }
  assert {
    condition     = google_secret_manager_secret.cloudflare_apply.secret_id == "mkc-cloudflare-apply-token" && google_secret_manager_secret_iam_member.cloudflare_apply.member == "serviceAccount:${module.github.emails["apply"]}" && google_secret_manager_secret_iam_member.cloudflare_apply.role == "roles/secretmanager.secretAccessor"
    error_message = "Apply must receive only its dedicated editable provider credential."
  }
  assert {
    condition = (
      google_secret_manager_secret.cloudflare_worker.secret_id == "mkc-cloudflare-worker-token" &&
      google_secret_manager_secret.cloudflare_worker.deletion_protection &&
      google_secret_manager_secret_iam_member.cloudflare_worker.secret_id == google_secret_manager_secret.cloudflare_worker.secret_id &&
      google_secret_manager_secret_iam_member.cloudflare_worker.member == "serviceAccount:${module.github.emails["deploy"]}" &&
      google_secret_manager_secret_iam_member.cloudflare_worker.role == "roles/secretmanager.secretAccessor"
    )
    error_message = "Deploy must read only the dedicated protected Worker credential through the main-ref-bound identity."
  }
  assert {
    condition     = google_project_iam_member.apply.member == "serviceAccount:${module.github.emails["apply"]}" && google_project_iam_member.apply.role == google_project_iam_custom_role.environment_apply.name
    error_message = "Apply must use the environment-only custom role."
  }
  assert {
    condition = toset(google_project_iam_custom_role.environment_apply.permissions) == toset([
      "cloudsql.databases.create",
      "cloudsql.databases.delete",
      "cloudsql.databases.get",
      "cloudsql.databases.list",
      "cloudsql.databases.update",
      "cloudsql.instances.create",
      "cloudsql.instances.delete",
      "cloudsql.instances.get",
      "cloudsql.instances.list",
      "cloudsql.instances.update",
      "cloudsql.users.create",
      "cloudsql.users.delete",
      "cloudsql.users.get",
      "cloudsql.users.list",
      "cloudsql.users.update",
      "compute.globalAddresses.create",
      "compute.globalAddresses.delete",
      "compute.globalAddresses.get",
      "compute.globalAddresses.list",
      "compute.globalAddresses.setLabels",
      "compute.globalOperations.get",
      "compute.networks.get",
      "compute.projects.get",
      "compute.securityPolicies.create",
      "compute.securityPolicies.delete",
      "compute.securityPolicies.get",
      "compute.securityPolicies.list",
      "compute.securityPolicies.update",
      "logging.notificationRules.create",
      "logging.notificationRules.delete",
      "logging.notificationRules.get",
      "logging.notificationRules.list",
      "logging.notificationRules.update",
      "monitoring.alertPolicies.create",
      "monitoring.alertPolicies.delete",
      "monitoring.alertPolicies.get",
      "monitoring.alertPolicies.list",
      "monitoring.alertPolicies.update",
      "monitoring.notificationChannels.get",
      "monitoring.notificationChannels.list",
      "resourcemanager.projects.get",
      "serviceusage.services.use",
    ])
    error_message = "The apply role must stay limited to resources owned by the environment root and cannot change IAM."
  }
  assert {
    condition     = google_secret_manager_secret.cloudflare_plan.secret_id != google_secret_manager_secret.cloudflare.secret_id
    error_message = "The plan identity needs a separate read-only provider credential."
  }
  assert {
    condition     = google_secret_manager_secret.origin_ca.secret_id == "mkc-cloudflare-origin-ca-token" && google_secret_manager_secret.origin_ca.deletion_protection
    error_message = "The retired Origin CA Key ID must remain protected until its staged two-apply cleanup."
  }
}
run "explicit_ssl_adoption" {
  command = plan
  variables {
    manage_zone_settings = true
  }
  assert {
    condition     = cloudflare_zone_setting.tls[0].value == "strict"
    error_message = "Opt-in TLS management must use Full (strict)."
  }
}
run "reject_invalid_domain" {
  command = plan
  variables {
    domain = "Invalid..example"
  }
  expect_failures = [var.domain]
}

run "shared_preview_resources" {
  command = apply
  assert {
    condition = (
      google_compute_address.preview_ingress.project == var.project &&
      google_compute_address.preview_ingress.name == "mkc-preview-ingress" &&
      google_compute_address.preview_ingress.region == var.region &&
      google_compute_address.preview_ingress.address_type == "EXTERNAL" &&
      google_compute_address.preview_ingress.ip_version == "IPV4" &&
      output.preview_ingress_ip == google_compute_address.preview_ingress.address
    )
    error_message = "The shared ingress must reserve regional external IPv4 and export its address."
  }
  assert {
    condition = (
      google_storage_bucket.preview_blobs.project == var.project &&
      google_storage_bucket.preview_blobs.name == "mokly-508518-preview-blobs" &&
      lower(google_storage_bucket.preview_blobs.location) == var.region &&
      google_storage_bucket.preview_blobs.uniform_bucket_level_access &&
      google_storage_bucket.preview_blobs.public_access_prevention == "enforced" &&
      !google_storage_bucket.preview_blobs.force_destroy &&
      !one(google_storage_bucket.preview_blobs.versioning).enabled &&
      one(google_storage_bucket.preview_blobs.soft_delete_policy).retention_duration_seconds == 604800 &&
      length(google_storage_bucket.preview_blobs.lifecycle_rule) == 0 &&
      output.preview_blobs_bucket == google_storage_bucket.preview_blobs.name
    )
    error_message = "The shared bucket must be private, unversioned, free of live-object age rules, protected from nonempty deletion and soft-delete for seven days."
  }
  assert {
    condition = (
      toset(keys(google_secret_manager_secret.preview)) == toset([
        "mkc-preview-origin-tls-key", "mkc-preview-origin-tls-cert", "mkc-catalogue-dns-token",
        "mkc-preview-sign-in-password",
      ]) &&
      alltrue([for id, secret in google_secret_manager_secret.preview :
        secret.project == var.project && secret.secret_id == id && secret.deletion_protection &&
        one(one(secret.replication).user_managed).replicas[0].location == var.region
      ])
    )
    error_message = "Foundation must own exactly the four protected regional shared secret IDs."
  }
  assert {
    condition = length(flatten([
      for filename in fileset(path.module, "*.tf") :
      regexall("resource\\s+\"google_secret_manager_secret_version\"", file("${path.module}/${filename}"))
    ])) == 0
    error_message = "Shared secret values remain operator-owned and never enter Terraform."
  }
}
run "shared_preview_dns" {
  command = apply
  assert {
    condition = (
      cloudflare_dns_record.preview_placeholder.name == "*.preview.example.invalid" &&
      cloudflare_dns_record.preview_api.name == "*.preview.api.example.invalid" &&
      alltrue([for record in [cloudflare_dns_record.preview_placeholder, cloudflare_dns_record.preview_api] :
        record.zone_id == var.zone_id && record.type == "A" && record.proxied && record.ttl == 1 &&
        record.content == google_compute_address.preview_ingress.address
      ])
    )
    error_message = "The app and API wildcards must point at the same shared ingress with automatic TTL."
  }
}
run "shared_preview_deploy_grants" {
  command = apply
  assert {
    condition = (
      google_storage_bucket_iam_member.deploy_preview.bucket == "mokly-508518-preview-blobs" &&
      google_storage_bucket_iam_member.deploy_preview.role == "roles/storage.admin" &&
      google_storage_bucket_iam_member.deploy_preview.member == "serviceAccount:${module.github.emails["deploy"]}" &&
      length(google_storage_bucket_iam_member.deploy_preview.condition) == 0
    )
    error_message = "Deploy may administer IAM and cleanup only on the shared preview bucket."
  }
  assert {
    condition = (
      toset(keys(google_secret_manager_secret_iam_member.deploy_preview)) == toset(keys(google_secret_manager_secret.preview)) &&
      alltrue([for id, grant in google_secret_manager_secret_iam_member.deploy_preview :
        grant.project == var.project && grant.secret_id == id &&
        grant.role == "roles/secretmanager.secretAccessor" &&
        grant.member == "serviceAccount:${module.github.emails["deploy"]}"
      ])
    )
    error_message = "Deploy reads exactly the four shared preview IDs."
  }
}
run "desktop_release_backups" {
  command = plan
  assert {
    condition = (
      toset(keys(google_secret_manager_secret.desktop_release)) == toset([
        "mkc-desktop-developer-id-p12", "mkc-desktop-developer-id-p12-password", "mkc-desktop-notary-api-key"
      ]) &&
      alltrue([for id, secret in google_secret_manager_secret.desktop_release :
        secret.project == var.project && secret.secret_id == id && secret.deletion_protection &&
        one(one(secret.replication).user_managed).replicas[0].location == var.region
      ])
    )
    error_message = "Foundation must own exactly the three protected regional desktop release backup IDs."
  }
  assert {
    condition = length(flatten([
      for filename in fileset(path.module, "*.tf") :
      regexall("mkc-desktop-|google_secret_manager_secret[.]desktop_release", file("${path.module}/${filename}"))
    ])) == 3
    error_message = "Desktop release backups stay operator-only: no grant or other resource may name them."
  }
}
run "stable_environment_inventory" {
  command = plan
  assert {
    condition = (
      keys(module.identity) == ["main-preview", "production"] &&
      keys(module.storage) == ["main-preview", "production"] &&
      keys(module.secrets) == ["main-preview", "production"] &&
      alltrue([for environment, secrets in module.secrets :
        length(secrets.ids) == 13 &&
        secrets.ids["e2b-api-key"] == "mkc-${environment}-e2b-api-key"
      ]) &&
      length(google_project_iam_member.sql) == 12 &&
      length(google_project_iam_member.database_reset) == 2 &&
      length(google_service_account_iam_member.deploy_database_reset) == 2 &&
      length(google_secret_manager_secret_iam_member.deploy_tls) == 4 &&
      length(google_secret_manager_secret_iam_member.deploy_catalogue) == 2
    )
    error_message = "Only the two stable environments get workload/reset accounts, buckets, secret IDs and SQL/TLS/catalogue grants."
  }
}
run "reject_pull_request_environment" {
  command = plan
  variables { environments = ["production", "main-preview", join("-", ["preview", "pr", "42"])] }
  expect_failures = [var.environments]
}
