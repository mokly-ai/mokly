# Operator-only backups of the desktop release credentials. The release
# workflow reads its GitHub Actions secrets, never these IDs. No identity
# receives a reader grant, and the values never enter Terraform.
resource "google_secret_manager_secret" "desktop_release" {
  for_each = toset([
    "mkc-desktop-developer-id-p12", "mkc-desktop-developer-id-p12-password", "mkc-desktop-notary-api-key"
  ])
  project   = var.project
  secret_id = each.key
  replication {
    user_managed {
      replicas {
        location = var.region
      }
    }
  }
  deletion_protection = true
  depends_on          = [google_project_service.apis]
}
