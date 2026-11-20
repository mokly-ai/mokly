variable "environments" {
  description = "Stable environments with dedicated workload identities, storage and secrets."
  type        = set(string)
  default     = ["production", "main-preview"]
  validation {
    condition     = alltrue([for name in var.environments : contains(["production", "main-preview"], name)])
    error_message = "Use only production or main-preview."
  }
}
module "identity" {
  for_each    = var.environments
  source      = "../modules/identity"
  project     = var.project
  environment = each.key
  depends_on  = [module.gke]
}
module "storage" {
  for_each        = var.environments
  source          = "../modules/storage"
  project         = var.project
  region          = var.region
  environment     = each.key
  workload_emails = module.identity[each.key].emails
}
module "secrets" {
  for_each        = var.environments
  source          = "../modules/secrets"
  project         = var.project
  region          = var.region
  environment     = each.key
  workload_emails = module.identity[each.key].emails
}
locals {
  sql_bindings = merge([for environment in var.environments : {
    for binding in setproduct(["api", "catalogue", "reset"], ["roles/cloudsql.client", "roles/cloudsql.instanceUser"]) :
    "${environment}/${binding[0]}/${binding[1]}" => {
      environment = environment
      workload    = binding[0]
      role        = binding[1]
    }
  }]...)
}
resource "google_project_iam_member" "sql" {
  for_each = local.sql_bindings
  project  = var.project
  role     = each.value.role
  member   = "serviceAccount:${module.identity[each.value.environment].emails[each.value.workload]}"
  condition {
    title      = "environment-sql"
    expression = "resource.name == 'projects/${var.project}/instances/mkc-${each.value.environment}'"
  }
}
# IAM conditions do not apply to Cloud SQL database operations, so an instance
# condition here would deny every reset; rollout.sh names the instance.
resource "google_project_iam_member" "database_reset" {
  for_each = var.environments
  project  = var.project
  role     = google_project_iam_custom_role.stable_database_reset.name
  member   = "serviceAccount:${module.identity[each.key].emails["reset"]}"
}
resource "google_service_account_iam_member" "deploy_database_reset" {
  for_each           = var.environments
  service_account_id = "projects/${var.project}/serviceAccounts/${module.identity[each.key].emails["reset"]}"
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${module.github.emails["deploy"]}"
}
resource "google_secret_manager_secret_iam_member" "deploy_tls" {
  for_each = { for pair in setproduct(var.environments, ["origin-tls-key", "origin-tls-cert"]) :
    "${pair[0]}/${pair[1]}" => { environment = pair[0], purpose = pair[1] }
  }
  project   = var.project
  secret_id = module.secrets[each.value.environment].ids[each.value.purpose]
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${module.github.emails["deploy"]}"
}
resource "google_secret_manager_secret_iam_member" "postmark_sync" {
  for_each  = var.environments
  project   = var.project
  secret_id = module.secrets[each.key].ids["postmark-token"]
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${module.github.emails["postmark"]}"
}

resource "google_secret_manager_secret_iam_member" "deploy_catalogue" {
  for_each  = var.environments
  project   = var.project
  secret_id = module.secrets[each.key].ids["stripe-catalogue-key"]
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${module.github.emails["deploy"]}"
}
