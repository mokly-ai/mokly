mock_provider "google" {}

variables {
  project    = "mokly-508518"
  region     = "us-central1"
  network_id = "projects/mokly-508518/global/networks/mkc"
  subnet_id  = "projects/mokly-508518/regions/us-central1/subnetworks/mkc"
}

run "contracts" {
  command = plan
  assert {
    condition     = google_container_cluster.this.enable_autopilot && google_container_cluster.this.deletion_protection
    error_message = "autopilot contract changed."
  }
  assert {
    condition     = google_container_cluster.this.private_cluster_config[0].enable_private_nodes && !google_container_cluster.this.control_plane_endpoints_config[0].ip_endpoints_config[0].enabled
    error_message = "private_nodes contract changed."
  }
  assert {
    condition     = google_container_cluster.this.secret_manager_config[0].enabled
    error_message = "secrets contract changed."
  }
}
