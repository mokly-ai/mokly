mock_provider "google" {}
mock_provider "cloudflare" {}
variables {
  notification_channels = ["projects/mokly-508518/notificationChannels/123"]
  catalogue_base_domain = "catalogues.invalid"
  catalogue_zone_id     = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  project               = "mokly-508518"
  region                = "us-central1"
  environment           = "main-preview"
  domain                = "example.invalid"
  zone_id               = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  network_id            = "projects/mokly-508518/global/networks/mkc"
}
run "topology" {
  command = plan
  assert {
    condition     = google_monitoring_alert_policy.publication_dead_letters.enabled && google_monitoring_alert_policy.publication_dead_letters.notification_channels == tolist(["projects/mokly-508518/notificationChannels/123"])
    error_message = "Undelivered check alerts must notify an operator."
  }
  assert {
    condition     = strcontains(google_monitoring_alert_policy.publication_dead_letters.conditions[0].condition_matched_log[0].filter, "jsonPayload.fields.dead_letter_count>0") && strcontains(google_monitoring_alert_policy.publication_dead_letters.conditions[0].condition_matched_log[0].filter, "mkc-main-preview") && strcontains(google_monitoring_alert_policy.publication_dead_letters.documentation[0].content, "docs/ops/check-recovery.md")
    error_message = "The alert must scope positive undelivered counts to its environment and link recovery."
  }
  assert {
    condition     = google_monitoring_alert_policy.billing_dead_letters.enabled && google_monitoring_alert_policy.billing_dead_letters.notification_channels == tolist(["projects/mokly-508518/notificationChannels/123"])
    error_message = "Undelivered billing delivery alerts must notify an operator."
  }
  assert {
    condition     = strcontains(google_monitoring_alert_policy.billing_dead_letters.conditions[0].condition_matched_log[0].filter, "jsonPayload.fields.message=\"billing delivery status\"") && strcontains(google_monitoring_alert_policy.billing_dead_letters.conditions[0].condition_matched_log[0].filter, "jsonPayload.fields.dead_letter_count>0") && strcontains(google_monitoring_alert_policy.billing_dead_letters.conditions[0].condition_matched_log[0].filter, "mkc-main-preview") && strcontains(google_monitoring_alert_policy.billing_dead_letters.documentation[0].content, "docs/ops/billing-smoke.md")
    error_message = "The billing alert must scope positive undelivered counts to its environment and link recovery."
  }
  assert {
    condition     = output.deployment.service_accounts.catalogue == "mkc-main-preview-cat@mokly-508518.iam.gserviceaccount.com" && output.deployment.service_accounts.reset == "mkc-main-preview-reset@mokly-508518.iam.gserviceaccount.com" && output.deployment.sql_users.api == "mkc-main-preview-api@mokly-508518.iam" && output.deployment.sql_users.catalogue == "mkc-main-preview-cat@mokly-508518.iam" && output.deployment.sql_users.reset == "mkc-main-preview-reset@mokly-508518.iam"
    error_message = "SQL users must derive from the same workload names as foundation."
  }
  assert {
    condition     = output.deployment.environment == "main-preview" && output.deployment.bucket == "mokly-508518-main-preview-blobs" && output.deployment.static_ip_name == "mkc-main-preview"
    error_message = "Environment resources must retain isolated deterministic names."
  }
  assert {
    condition     = output.deployment.hosts.app == "app-origin-main-preview.example.invalid" && output.deployment.hosts.api == "br-main.preview.api.example.invalid" && output.deployment.hosts.catalogue == "*.br-main.preview.catalogues.invalid" && output.deployment.public_app_origin == "https://br-main.preview.example.invalid" && output.deployment.service_accounts.api == "mkc-main-preview-api@mokly-508518.iam.gserviceaccount.com"
    error_message = "DNS and runtime identities must align with foundation."
  }
  assert {
    condition     = google_compute_security_policy.workloads.name == "mkc-main-preview" && anytrue([for rule in google_compute_security_policy.workloads.rule : rule.action == "throttle" && rule.priority == 1000])
    error_message = "Public health must have a Cloud Armor rate limit."
  }
}
run "production_domain_layout" {
  command = plan
  variables { environment = "production" }
  assert {
    condition     = output.deployment.hosts.app == "app-origin.example.invalid" && output.deployment.hosts.api == "api.example.invalid" && output.deployment.hosts.catalogue == "*.catalogues.invalid" && output.deployment.public_app_origin == "https://example.invalid"
    error_message = "Production must expose the apex origin and keep the app workload on its internal host."
  }
}
run "reject_unknown_environment" {
  command = plan
  variables { environment = "main" }
  expect_failures = [var.environment]
}
run "reject_unrouted_alert" {
  command = plan
  variables { notification_channels = [] }
  expect_failures = [var.notification_channels]
}
run "reject_invalid_domain" {
  command = plan
  variables { domain = "Invalid..example" }
  expect_failures = [var.domain]
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
