mock_provider "google" {}

variables {
  project         = "mokly-508518"
  region          = "us-central1"
  environment     = "main-preview"
  network_id      = "projects/mokly-508518/global/networks/mkc"
  workload_emails = { "api" : "mkc-main-preview-api@mokly-508518.iam.gserviceaccount.com", "catalogue" : "mkc-main-preview-cat@mokly-508518.iam.gserviceaccount.com", "reset" : "mkc-main-preview-reset@mokly-508518.iam.gserviceaccount.com" }
}

run "contracts" {
  command = plan
  assert {
    condition     = !google_sql_database_instance.this.settings[0].ip_configuration[0].ipv4_enabled && google_sql_database_instance.this.settings[0].ip_configuration[0].ssl_mode == "ENCRYPTED_ONLY"
    error_message = "private_sql contract changed."
  }
  assert {
    condition     = google_sql_database_instance.this.settings[0].backup_configuration[0].enabled && google_sql_database_instance.this.settings[0].backup_configuration[0].point_in_time_recovery_enabled
    error_message = "recovery contract changed."
  }
  assert {
    condition     = google_sql_database_instance.this.deletion_protection
    error_message = "stable_protection contract changed."
  }
  assert {
    condition     = alltrue([for user in google_sql_user.workload : user.type == "CLOUD_IAM_SERVICE_ACCOUNT"])
    error_message = "iam_users contract changed."
  }
  assert {
    condition     = google_sql_user.workload["reset"].database_roles == tolist(["cloudsqlsuperuser"]) && try(length(google_sql_user.workload["api"].database_roles), 0) == 0 && try(length(google_sql_user.workload["catalogue"].database_roles), 0) == 0
    error_message = "Only the non-serving reset identity may recreate a stable database."
  }
}

run "production_ha" {
  command = plan
  variables { environment = "production" }
  assert {
    condition     = google_sql_database_instance.this.settings[0].availability_type == "REGIONAL" && google_sql_database_instance.this.deletion_protection
    error_message = "Production must retain HA and deletion protection."
  }
}

run "reject_pull_request_environment" {
  command = plan
  variables { environment = join("-", ["preview", "pr", "42"]) }
  expect_failures = [var.environment]
}
run "reject_other_branch_environment" {
  command = plan
  variables { environment = "release-preview" }
  expect_failures = [var.environment]
}
