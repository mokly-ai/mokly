variable "zone_id" {
  type = string
}
variable "domain" {
  type = string
  validation {
    condition     = length(var.domain) <= 253 && can(regex("^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\\.[a-z]{2,63}$", var.domain))
    error_message = "Use a lowercase DNS domain with valid labels and a letter-only top-level domain."
  }
}
variable "state_bucket" {
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
  default = "mokly-ai/mokly-cloud"
}
resource "google_project_service" "apis" {
  for_each           = toset(["cloudresourcemanager.googleapis.com", "compute.googleapis.com", "container.googleapis.com", "sqladmin.googleapis.com", "servicenetworking.googleapis.com", "secretmanager.googleapis.com", "artifactregistry.googleapis.com", "iam.googleapis.com", "iamcredentials.googleapis.com", "sts.googleapis.com", "logging.googleapis.com", "monitoring.googleapis.com"])
  project            = var.project
  service            = each.value
  disable_on_destroy = false
}
module "network" {
  source     = "../modules/network"
  project    = var.project
  region     = var.region
  depends_on = [google_project_service.apis]
}
module "gke" {
  source     = "../modules/gke"
  project    = var.project
  region     = var.region
  network_id = module.network.network_id
  subnet_id  = module.network.subnet_id
}
module "github" {
  source        = "../modules/github"
  project       = var.project
  repository_id = var.repository_id
  owner_id      = var.owner_id
  repository    = var.repository
  depends_on    = [google_project_service.apis]
}
resource "google_artifact_registry_repository" "images" {
  project       = var.project
  location      = var.region
  repository_id = "mokly"
  format        = "DOCKER"
  cleanup_policies {
    id     = "expire-preview-images"
    action = "DELETE"
    condition {
      tag_state    = "TAGGED"
      tag_prefixes = ["preview-"]
      older_than   = "604800s"
    }
  }
  cleanup_policies {
    id     = "retain-releases"
    action = "KEEP"
    condition {
      tag_state    = "TAGGED"
      tag_prefixes = ["release-"]
    }
  }
  depends_on = [google_project_service.apis]
}
resource "google_secret_manager_secret" "cloudflare" {
  project   = var.project
  secret_id = "mkc-cloudflare-api-token"
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
variable "manage_zone_settings" {
  type    = bool
  default = false
}
resource "cloudflare_zone_setting" "tls" {
  count      = var.manage_zone_settings ? 1 : 0
  zone_id    = var.zone_id
  setting_id = "ssl"
  value      = "strict"
}
resource "cloudflare_certificate_pack" "app_api" {
  zone_id               = var.zone_id
  type                  = "advanced"
  hosts                 = [var.domain, "*.preview.${var.domain}", "*.preview.api.${var.domain}"]
  validation_method     = "txt"
  validity_days         = 90
  certificate_authority = "lets_encrypt"
  cloudflare_branding   = false
}
resource "google_secret_manager_secret" "cloudflare_plan" {
  project   = var.project
  secret_id = "mkc-cloudflare-plan-token"
  replication {
    user_managed {
      replicas { location = var.region }
    }
  }
  deletion_protection = true
  depends_on          = [google_project_service.apis]
}
resource "google_secret_manager_secret" "cloudflare_apply" {
  project   = var.project
  secret_id = "mkc-cloudflare-apply-token"
  replication {
    user_managed {
      replicas { location = var.region }
    }
  }
  deletion_protection = true
  depends_on          = [google_project_service.apis]
}
resource "google_secret_manager_secret" "cloudflare_worker" {
  project   = var.project
  secret_id = "mkc-cloudflare-worker-token"
  replication {
    user_managed {
      replicas { location = var.region }
    }
  }
  deletion_protection = true
  depends_on          = [google_project_service.apis]
}
output "network_id" {
  value = module.network.network_id
}
output "cluster" {
  value = module.gke.name
}
output "workload_identity_provider" {
  value = module.github.provider
}
output "github_service_accounts" {
  value = module.github.emails
}
resource "google_secret_manager_secret" "origin_ca" {
  project   = var.project
  secret_id = "mkc-cloudflare-origin-ca-token"
  replication {
    user_managed {
      replicas { location = var.region }
    }
  }
  deletion_protection = true
  depends_on          = [google_project_service.apis]
}
