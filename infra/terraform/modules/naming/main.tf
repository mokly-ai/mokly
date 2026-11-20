variable "project" {
  description = "Project containing the workload accounts and blob buckets."
  type        = string
}
variable "environment" {
  description = "Validated environment name supplied by the owning stack."
  type        = string
  validation {
    condition     = contains(["production", "main-preview"], var.environment)
    error_message = "Use only production or main-preview."
  }
}
locals {
  namespace = "mkc-${var.environment}"
  account_ids = {
    for workload, suffix in { api = "api", catalogue = "cat", reset = "reset" } :
    workload => "${local.namespace}-${suffix}"
  }
}
output "namespace" {
  value = local.namespace
}
output "account_ids" {
  value = local.account_ids
}
output "emails" {
  value = { for workload, id in local.account_ids : workload => "${id}@${var.project}.iam.gserviceaccount.com" }
}
output "bucket" {
  value = "${var.project}-${var.environment}-blobs"
}
