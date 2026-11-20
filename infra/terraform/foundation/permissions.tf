locals {
  deploy_roles = toset(["roles/container.developer"])
  plan_roles   = toset(["roles/compute.viewer", "roles/monitoring.viewer", "roles/container.viewer", "roles/cloudsql.viewer", "roles/secretmanager.viewer", "roles/serviceusage.serviceUsageConsumer"])
  preview_platform_deploy_permissions = [
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
  ]
  stable_database_reset_permissions = [
    "cloudsql.databases.create",
    "cloudsql.databases.delete",
    "cloudsql.databases.list",
  ]
  environment_apply_permissions = [
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
  ]
}
resource "google_project_iam_custom_role" "environment_apply" {
  project     = var.project
  role_id     = "mkcEnvironmentApply"
  title       = "Mokly environment apply"
  description = "Applies the stable per-environment Terraform root after a protected main merge."
  permissions = local.environment_apply_permissions
}
resource "google_project_iam_custom_role" "preview_platform_deploy" {
  project     = var.project
  role_id     = "mkcPreviewPlatformDeploy"
  title       = "Mokly preview platform deploy"
  description = "Installs preview platform chart RBAC and webhooks."
  permissions = local.preview_platform_deploy_permissions
}
resource "google_project_iam_custom_role" "stable_database_reset" {
  project     = var.project
  role_id     = "mkcStableDatabaseReset"
  title       = "Mokly stable database reset"
  description = "Recreates one stable database after an explicit destructive release reset."
  permissions = local.stable_database_reset_permissions
}
resource "google_project_iam_member" "apply" {
  project = var.project
  role    = google_project_iam_custom_role.environment_apply.name
  member  = "serviceAccount:${module.github.emails["apply"]}"
}
resource "google_project_iam_member" "deploy" {
  for_each = local.deploy_roles
  project  = var.project
  role     = each.value
  member   = "serviceAccount:${module.github.emails["deploy"]}"
}
resource "google_project_iam_member" "preview_platform_deploy" {
  project = var.project
  role    = google_project_iam_custom_role.preview_platform_deploy.name
  member  = "serviceAccount:${module.github.emails["deploy"]}"
}
resource "google_project_iam_member" "plan" {
  for_each = local.plan_roles
  project  = var.project
  role     = each.value
  member   = "serviceAccount:${module.github.emails["plan"]}"
}
resource "google_storage_bucket_iam_member" "state" {
  for_each = { apply = module.github.emails["apply"], foundation = module.github.emails["foundation"], plan = module.github.emails["plan"] }
  bucket   = var.state_bucket
  role     = "roles/storage.objectAdmin"
  member   = "serviceAccount:${each.value}"
}
resource "google_artifact_registry_repository_iam_member" "writer" {
  project    = var.project
  location   = var.region
  repository = google_artifact_registry_repository.images.name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${module.github.emails["deploy"]}"
}
resource "google_secret_manager_secret_iam_member" "cloudflare_plan" {
  project   = var.project
  secret_id = google_secret_manager_secret.cloudflare_plan.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${module.github.emails["plan"]}"
}
resource "google_secret_manager_secret_iam_member" "cloudflare_apply" {
  project   = var.project
  secret_id = google_secret_manager_secret.cloudflare_apply.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${module.github.emails["apply"]}"
}
resource "google_secret_manager_secret_iam_member" "cloudflare_worker" {
  project   = var.project
  secret_id = google_secret_manager_secret.cloudflare_worker.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${module.github.emails["deploy"]}"
}
