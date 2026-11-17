variable "project" {
  type = string
}
variable "region" {
  type = string
}
resource "google_compute_network" "this" {
  project                 = var.project
  name                    = "mkc"
  auto_create_subnetworks = false
}
resource "google_compute_subnetwork" "this" {
  project                  = var.project
  name                     = "mkc"
  region                   = var.region
  network                  = google_compute_network.this.id
  ip_cidr_range            = "10.20.0.0/20"
  private_ip_google_access = true
  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = "10.24.0.0/14"
  }
  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = "10.28.0.0/20"
  }

}
resource "google_compute_global_address" "sql" {
  project       = var.project
  name          = "mkc-private-services"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  address       = "10.30.0.0"
  network       = google_compute_network.this.id
}
resource "google_service_networking_connection" "sql" {
  network                 = google_compute_network.this.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.sql.name]
  deletion_policy         = "ABANDON"
}
resource "google_compute_router" "this" {
  project = var.project
  name    = "mkc"
  region  = var.region
  network = google_compute_network.this.id
}
resource "google_compute_router_nat" "this" {
  project                            = var.project
  name                               = "mkc-egress"
  router                             = google_compute_router.this.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }

}
output "network_id" {
  value = google_compute_network.this.id
}
output "subnet_id" {
  value = google_compute_subnetwork.this.id
}
