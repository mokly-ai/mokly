mock_provider "cloudflare" {}

variables {
  catalogue_base_domain = "catalogues.invalid"
  catalogue_zone_id     = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  zone_id               = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  domain                = "example.invalid"
  environment           = "main-preview"
  address               = "192.0.2.1"
}

run "contracts" {
  command = plan
  assert {
    condition     = cloudflare_dns_record.this["catalogue"].zone_id == var.catalogue_zone_id && cloudflare_certificate_pack.catalogue[0].zone_id == var.catalogue_zone_id && cloudflare_dns_record.this["app"].zone_id == var.zone_id
    error_message = "App/API and untrusted catalogue content must use their respective DNS zones."
  }
  assert {
    condition     = cloudflare_dns_record.this["app"].name == "app-origin-main-preview.example.invalid" && cloudflare_dns_record.this["api"].name == "br-main.preview.api.example.invalid" && cloudflare_dns_record.this["catalogue"].name == "*.br-main.preview.catalogues.invalid"
    error_message = "origins contract changed."
  }
  assert {
    condition     = output.hosts == { app = "app-origin-main-preview.example.invalid", api = "br-main.preview.api.example.invalid", catalogue = "*.br-main.preview.catalogues.invalid" } && output.public_app_origin == "https://br-main.preview.example.invalid"
    error_message = "Main-preview DNS and public-origin outputs must use the unified layout."
  }
  assert {
    condition     = length(cloudflare_dns_record.this) == 3 && alltrue([for record in cloudflare_dns_record.this : record.proxied])
    error_message = "no_site_records contract changed."
  }
  assert {
    condition     = length(cloudflare_certificate_pack.catalogue) == 1 && cloudflare_certificate_pack.catalogue[0].type == "advanced" && cloudflare_certificate_pack.catalogue[0].certificate_authority == "lets_encrypt" && contains(cloudflare_certificate_pack.catalogue[0].hosts, "*.br-main.preview.catalogues.invalid")
    error_message = "Preview wildcard TLS must use the catalogue zone's Let's Encrypt advanced pack."
  }
}

run "production_uses_universal_ssl" {
  command = plan
  variables { environment = "production" }
  assert {
    condition     = output.hosts.app == "app-origin.example.invalid" && output.hosts.api == "api.example.invalid" && output.hosts.catalogue == "*.catalogues.invalid" && output.public_app_origin == "https://example.invalid" && length(cloudflare_certificate_pack.catalogue) == 0
    error_message = "Production's first-level catalogue wildcard must use Universal SSL without an advanced pack."
  }
}
run "reject_shared_catalogue_site" {
  command = plan
  variables { catalogue_base_domain = "example.invalid" }
  expect_failures = [var.catalogue_base_domain]
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
