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
  type = map(string)
}
module "naming" {
  source      = "../naming"
  project     = var.project
  environment = var.environment
}
resource "google_storage_bucket" "blobs" {
  project                     = var.project
  name                        = module.naming.bucket
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false
  versioning {
    enabled = true
  }
  soft_delete_policy {
    retention_duration_seconds = 604800
  }
  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      days_since_noncurrent_time = 30
      with_state                 = "ARCHIVED"
    }

  }
  lifecycle_rule {
    action {
      type = "AbortIncompleteMultipartUpload"
    }
    condition {
      age = 7
    }

  }

}
resource "google_storage_bucket_iam_member" "objects" {
  for_each = {
    api = "roles/storage.objectAdmin", catalogue = "roles/storage.objectViewer"
  }
  bucket = google_storage_bucket.blobs.name
  role   = each.value
  member = "serviceAccount:${var.workload_emails[each.key]}"
}
output "name" {
  value = google_storage_bucket.blobs.name
}
output "iam_members" {
  description = "Bucket principals for the foundation IAM policy contract."
  value       = { for workload, grant in google_storage_bucket_iam_member.objects : workload => grant.member }
}
