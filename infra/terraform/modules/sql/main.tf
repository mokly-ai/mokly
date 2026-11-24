variable "project" {
  type = string
}
variable "region" {
  type = string
}
variable "environment" {
  type = string
  validation {
    condition     = contains(["production", "main-preview"], var.environment)
    error_message = "Use only production or main-preview."
  }
}
variable "network_id" {
  type = string
}
variable "workload_emails" {
  type = map(string)
}
resource "google_sql_database_instance" "this" {
  project             = var.project
  name                = "mkc-${var.environment}"
  region              = var.region
  database_version    = "POSTGRES_16"
  deletion_protection = true
  settings {
    tier                        = "db-custom-1-3840"
    edition                     = "ENTERPRISE"
    availability_type           = var.environment == "production" ? "REGIONAL" : "ZONAL"
    disk_type                   = "PD_SSD"
    disk_size                   = 20
    disk_autoresize             = true
    deletion_protection_enabled = true
    database_flags {
      name  = "cloudsql.iam_authentication"
      value = "on"
    }
    ip_configuration {
      ipv4_enabled    = false
      private_network = var.network_id
      ssl_mode        = "ENCRYPTED_ONLY"
    }
    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7
      backup_retention_settings {
        retained_backups = 7
        retention_unit   = "COUNT"
      }

    }
    maintenance_window {
      day          = 7
      hour         = 4
      update_track = "stable"
    }

  }

}
resource "google_sql_database" "this" {
  project  = var.project
  name     = "mokly"
  instance = google_sql_database_instance.this.name
}
resource "google_sql_user" "workload" {
  for_each       = var.workload_emails
  project        = var.project
  instance       = google_sql_database_instance.this.name
  name           = trimsuffix(each.value, ".gserviceaccount.com")
  type           = "CLOUD_IAM_SERVICE_ACCOUNT"
  database_roles = each.key == "reset" ? ["cloudsqlsuperuser"] : []
}
output "connection_name" {
  value = google_sql_database_instance.this.connection_name
}
output "users" {
  value = {
    for key, user in google_sql_user.workload : key => user.name
  }

}
