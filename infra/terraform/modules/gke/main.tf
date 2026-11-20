variable "project" {
  type = string
}
variable "region" {
  type = string
}
variable "network_id" {
  type = string
}
variable "subnet_id" {
  type = string
}
resource "google_service_account" "nodes" {
  project    = var.project
  account_id = "mkc-gke-nodes"
}
resource "google_project_iam_member" "nodes" {
  for_each = toset(["roles/container.defaultNodeServiceAccount", "roles/artifactregistry.reader"])
  project  = var.project
  role     = each.value
  member   = "serviceAccount:${google_service_account.nodes.email}"
}
resource "google_container_cluster" "this" {
  project             = var.project
  name                = "mkc-autopilot"
  location            = var.region
  enable_autopilot    = true
  deletion_protection = true
  network             = var.network_id
  subnetwork          = var.subnet_id
  release_channel {
    channel = "REGULAR"
  }
  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }
  private_cluster_config {
    enable_private_nodes = true
  }
  control_plane_endpoints_config {
    dns_endpoint_config {
      allow_external_traffic = true
    }
    ip_endpoints_config {
      enabled = false
    }

  }
  cluster_autoscaling {
    auto_provisioning_defaults {
      service_account = google_service_account.nodes.email
    }

  }
  secret_manager_config {
    enabled = true
  }
  depends_on = [google_project_iam_member.nodes]
}
output "name" {
  value = google_container_cluster.this.name
}
