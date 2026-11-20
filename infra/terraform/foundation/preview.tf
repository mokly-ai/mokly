resource "google_compute_address" "preview_ingress" {
  project      = var.project
  name         = "mkc-preview-ingress"
  region       = var.region
  address_type = "EXTERNAL"
  ip_version   = "IPV4"
  depends_on   = [google_project_service.apis]
}

resource "google_storage_bucket" "preview_blobs" {
  project                     = var.project
  name                        = "${var.project}-preview-blobs"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false
  versioning {
    enabled = false
  }
  soft_delete_policy {
    retention_duration_seconds = 604800
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret" "preview" {
  for_each = toset([
    "mkc-preview-origin-tls-key", "mkc-preview-origin-tls-cert", "mkc-catalogue-dns-token"
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

resource "cloudflare_dns_record" "preview_placeholder" {
  zone_id = var.zone_id
  name    = "*.preview.${var.domain}"
  type    = "A"
  content = google_compute_address.preview_ingress.address
  proxied = true
  ttl     = 1
}

resource "cloudflare_dns_record" "preview_api" {
  zone_id = var.zone_id
  name    = "*.preview.api.${var.domain}"
  type    = "A"
  content = google_compute_address.preview_ingress.address
  proxied = true
  ttl     = 1
}

resource "google_secret_manager_secret_iam_member" "deploy_preview" {
  for_each  = google_secret_manager_secret.preview
  project   = var.project
  secret_id = each.value.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${module.github.emails["deploy"]}"
}

resource "google_storage_bucket_iam_member" "deploy_preview" {
  bucket = google_storage_bucket.preview_blobs.name
  role   = "roles/storage.admin"
  member = "serviceAccount:${module.github.emails["deploy"]}"
}

output "preview_ingress_ip" {
  description = "Shared regional preview ingress IPv4 for MKC_PREVIEW_INGRESS_IP."
  value       = google_compute_address.preview_ingress.address
}

output "preview_blobs_bucket" {
  description = "Shared preview bucket for MKC_PREVIEW_BLOBS_BUCKET."
  value       = google_storage_bucket.preview_blobs.name
}
