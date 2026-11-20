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
  type    = string
  default = "mokly-ai/mokly"
}
variable "legacy_repository_id" {
  type    = string
  default = ""
  validation {
    condition     = var.legacy_repository_id == "" || can(regex("^[1-9][0-9]*$", var.legacy_repository_id))
    error_message = "The old repository ID must be empty or a numeric GitHub ID."
  }
}
locals {
  trusted_repositories = merge(
    { (var.repository) = var.repository_id },
    var.legacy_repository_id == "" ? {} : { "mokly-ai/mokly-cloud" = var.legacy_repository_id }
  )
  repository_conditions = [for repository, id in local.trusted_repositories :
    "(assertion.repository == '${repository}' && assertion.repository_id == '${id}' && assertion.workflow_ref in ['${repository}/.github/workflows/deploy.yml@refs/heads/main', '${repository}/.github/workflows/preview.yml@refs/heads/main', '${repository}/.github/workflows/ci.yml@refs/heads/main', '${repository}/.github/workflows/foundation.yml@refs/heads/main'])"
  ]
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
  attribute_condition = "assertion.repository_owner_id == '${var.owner_id}' && (${join(" || ", local.repository_conditions)})"
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
  trust = merge([for repository in keys(local.trusted_repositories) : merge([for role, names in local.workflows : {
    for name in names : "${repository}/${role}/${name}" => { role = role, workflow = name, repository = repository }
    }
  ]...)]...)
}
resource "google_service_account_iam_member" "github" {
  for_each           = local.trust
  service_account_id = google_service_account.github[each.value.role].name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.workflow_ref/${each.value.repository}/.github/workflows/${each.value.workflow}.yml@refs/heads/main"
}
output "provider" {
  value = google_iam_workload_identity_pool_provider.github.name
}
output "emails" {
  value = {
    for key, account in google_service_account.github : key => account.email
  }

}
