variable "project" {
  type = string
}
variable "region" {
  type = string
}
variable "environment" {
  type = string
  validation {
    condition     = contains(["production", "main-preview"], var.environment)
    error_message = "Use only production or main-preview."
  }
}
variable "workload_emails" {
  description = "Google service accounts annotated on the API and catalogue Kubernetes accounts."
  type = object({
    api       = string
    catalogue = string
  })
}
locals {
  purposes = toset(["origin-tls-key", "origin-tls-cert", "origin-tls-id", "github-app-key", "github-client-secret", "github-webhook-secret", "publish-smoke-token", "catalogue-signing-key", "postmark-token", "stripe-catalogue-key", "stripe-secret-key", "stripe-webhook-secret", "e2b-api-key"])
}
resource "google_secret_manager_secret" "this" {
  for_each  = local.purposes
  project   = var.project
  secret_id = "mkc-${var.environment}-${each.key}"
  replication {
    user_managed {
      replicas {
        location = var.region
      }

    }
  }
  deletion_protection = true
}
locals {
  workload_secrets = {
    api       = toset(["catalogue-signing-key", "github-app-key", "github-client-secret", "github-webhook-secret", "postmark-token", "stripe-secret-key", "stripe-webhook-secret", "e2b-api-key"])
    catalogue = toset(["catalogue-signing-key"])
  }
  readers = merge([for workload, purposes in local.workload_secrets : {
    for purpose in purposes : "${workload}/${purpose}" => {
      workload = workload
      purpose  = purpose
    }
  }]...)
}
resource "google_secret_manager_secret_iam_member" "workload" {
  for_each  = local.readers
  project   = var.project
  secret_id = google_secret_manager_secret.this[each.value.purpose].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.workload_emails[each.value.workload]}"
}
output "ids" {
  value = {
    for key, secret in google_secret_manager_secret.this : key => secret.secret_id
  }
}
