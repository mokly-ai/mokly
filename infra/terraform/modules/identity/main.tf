variable "project" {
  type = string
}
variable "environment" {
  type = string
  validation {
    condition     = contains(["production", "main-preview"], var.environment)
    error_message = "Use only production or main-preview."
  }
}
module "naming" {
  source      = "../naming"
  project     = var.project
  environment = var.environment
}
resource "google_service_account" "workload" {
  for_each   = module.naming.account_ids
  project    = var.project
  account_id = each.value
}
resource "google_service_account_iam_member" "workload" {
  for_each           = module.naming.account_ids
  service_account_id = google_service_account.workload[each.key].name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project}.svc.id.goog[${module.naming.namespace}/${each.key}]"
}
output "emails" {
  value = {
    for name, account in google_service_account.workload : name => account.email
  }

}
