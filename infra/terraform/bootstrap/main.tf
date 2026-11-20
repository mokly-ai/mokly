variable "state_bucket" {
  type = string
}
resource "google_storage_bucket" "state" {
  project                     = var.project
  name                        = var.state_bucket
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
  lifecycle {
    prevent_destroy = true
  }

}
output "state_bucket" {
  value = google_storage_bucket.state.name
}
