variable "zone_id" {
  type = string
}
variable "domain" {
  type = string
}
variable "catalogue_base_domain" {
  type = string
  validation {
    condition     = var.catalogue_base_domain != var.domain && !endswith(var.catalogue_base_domain, ".${var.domain}") && !endswith(var.domain, ".${var.catalogue_base_domain}")
    error_message = "Catalogue hosting needs an independent registrable domain; the runtime additionally validates the Public Suffix List."
  }
}
variable "catalogue_zone_id" {
  type = string
}
variable "environment" {
  type = string
  validation {
    condition     = contains(["production", "main-preview"], var.environment)
    error_message = "Use only production or main-preview."
  }
}
variable "address" {
  type = string
}
locals {
  suffix           = var.environment == "production" ? "" : "-${var.environment}"
  branch           = trimsuffix(var.environment, "-preview")
  preview_label    = "br-${local.branch}"
  catalogue_domain = var.environment == "production" ? var.catalogue_base_domain : "${local.preview_label}.preview.${var.catalogue_base_domain}"
  hosts = {
    app       = "app-origin${local.suffix}.${var.domain}"
    api       = var.environment == "production" ? "api.${var.domain}" : "${local.preview_label}.preview.api.${var.domain}"
    catalogue = "*.${local.catalogue_domain}"
  }
  public_app_origin = var.environment == "production" ? "https://${var.domain}" : "https://${local.preview_label}.preview.${var.domain}"
}
resource "cloudflare_dns_record" "this" {
  for_each = local.hosts
  zone_id  = each.key == "catalogue" ? var.catalogue_zone_id : var.zone_id
  name     = each.value
  type     = "A"
  content  = var.address
  proxied  = true
  ttl      = 1
}
resource "cloudflare_certificate_pack" "catalogue" {
  count                 = var.environment == "main-preview" ? 1 : 0
  zone_id               = var.catalogue_zone_id
  type                  = "advanced"
  hosts                 = [local.hosts.catalogue]
  validation_method     = "txt"
  validity_days         = 90
  certificate_authority = "lets_encrypt"
  cloudflare_branding   = false
}
output "hosts" {
  value = local.hosts
}
output "public_app_origin" {
  value = local.public_app_origin
}

moved {
  from = cloudflare_certificate_pack.catalogue["preview"]
  to   = cloudflare_certificate_pack.catalogue[0]
}
