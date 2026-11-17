variable "project" {
  type = string
}
variable "repository_id" {
  type = string
}
variable "owner_id" {
  type = string
}
variable "repository" {
  type = string
}
resource "google_iam_workload_identity_pool" "github" {
  project                   = var.project
  workload_identity_pool_id = "mkc-github"
  display_name              = "Mokly GitHub Actions"
}
resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  project                            = var.project
  attribute_mapping = {
    "google.subject"          = "assertion.sub"
    "attribute.repository_id" = "assertion.repository_id"
    "attribute.workflow_ref"  = "assertion.workflow_ref"
  }
  attribute_condition = "assertion.repository_id == '${var.repository_id}' && assertion.repository_owner_id == '${var.owner_id}' && assertion.workflow_ref in ['${var.repository}/.github/workflows/deploy.yml@refs/heads/main', '${var.repository}/.github/workflows/preview.yml@refs/heads/main', '${var.repository}/.github/workflows/ci.yml@refs/heads/main', '${var.repository}/.github/workflows/foundation.yml@refs/heads/main']"
  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }

}
resource "google_service_account" "github" {
  for_each   = toset(["apply", "deploy", "foundation", "plan", "postmark"])
  project    = var.project
  account_id = "mkc-github-${each.key}"
}
locals {
  workflows = {
    apply = ["deploy"], deploy = ["deploy", "preview"], foundation = ["foundation"], plan = ["ci", "deploy", "foundation"], postmark = ["deploy"]
  }
  trust = merge([for role, names in local.workflows : {
    for name in names : "${role}/${name}" => { role = role, workflow = name }
    }
  ]...)
}
resource "google_service_account_iam_member" "github" {
  for_each           = local.trust
  service_account_id = google_service_account.github[each.value.role].name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.workflow_ref/${var.repository}/.github/workflows/${each.value.workflow}.yml@refs/heads/main"
}
output "provider" {
  value = google_iam_workload_identity_pool_provider.github.name
}
output "emails" {
  value = {
    for key, account in google_service_account.github : key => account.email
  }

}
