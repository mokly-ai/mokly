variable "environment" {
  type = string
  validation {
    condition     = contains(["production", "main-preview"], var.environment)
    error_message = "Use only production or main-preview."
  }

}
variable "domain" {
  type = string
  validation {
    condition     = length(var.domain) <= 253 && can(regex("^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\\.[a-z]{2,63}$", var.domain))
    error_message = "Use a lowercase DNS domain with valid labels and a letter-only top-level domain."
  }
}
variable "zone_id" {
  type = string
}
variable "catalogue_base_domain" {
  type = string
}
variable "catalogue_zone_id" {
  type = string
}
variable "network_id" {
  type = string
}
module "naming" {
  source      = "../modules/naming"
  project     = var.project
  environment = var.environment
}
module "sql" {
  source          = "../modules/sql"
  project         = var.project
  region          = var.region
  environment     = var.environment
  network_id      = var.network_id
  workload_emails = module.naming.emails
}
resource "google_compute_global_address" "ingress" {
  project = var.project
  name    = "mkc-${var.environment}"
}
module "dns" {
  catalogue_base_domain = var.catalogue_base_domain
  catalogue_zone_id     = var.catalogue_zone_id
  source                = "../modules/dns"
  zone_id               = var.zone_id
  domain                = var.domain
  environment           = var.environment
  address               = google_compute_global_address.ingress.address
}
output "deployment" {
  value = {
    environment       = var.environment
    public_app_origin = module.dns.public_app_origin
    project           = var.project
    region            = var.region
    hosts             = module.dns.hosts
    bucket            = module.naming.bucket
    sql_connection    = module.sql.connection_name
    sql_users         = module.sql.users
    service_accounts  = module.naming.emails
    security_policy   = google_compute_security_policy.workloads.name
    static_ip_name    = google_compute_global_address.ingress.name
    ingress_address   = google_compute_global_address.ingress.address
  }

}
