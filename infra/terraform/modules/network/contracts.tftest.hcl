mock_provider "google" {}

variables {
  project = "mokly-508518"
  region  = "us-central1"
}

run "contracts" {
  command = plan
  assert {
    condition     = !google_compute_network.this.auto_create_subnetworks && google_compute_subnetwork.this.private_ip_google_access
    error_message = "private_network contract changed."
  }
  assert {
    condition     = google_compute_global_address.sql.purpose == "VPC_PEERING" && google_compute_global_address.sql.address == "10.30.0.0"
    error_message = "sql_peering contract changed."
  }
}
