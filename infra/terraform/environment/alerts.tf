variable "notification_channels" {
  type = list(string)
  validation {
    condition     = length(var.notification_channels) > 0 && alltrue([for channel in var.notification_channels : can(regex("^projects/mokly-508518/notificationChannels/[0-9]+$", channel))])
    error_message = "Supply at least one existing operator notification channel in mokly-508518."
  }
}

resource "google_monitoring_alert_policy" "publication_dead_letters" {
  project               = var.project
  display_name          = "mkc-${var.environment}: undelivered publication checks"
  combiner              = "OR"
  enabled               = true
  notification_channels = var.notification_channels
  conditions {
    display_name = "Undelivered publication check dead-letter count is positive"
    condition_matched_log {
      filter = "resource.type=\"k8s_container\" AND resource.labels.namespace_name=\"mkc-${var.environment}\" AND resource.labels.container_name=\"maintenance\" AND jsonPayload.fields.message=\"publication check status\" AND jsonPayload.fields.dead_letter_count>0"
    }
  }
  alert_strategy {
    notification_rate_limit { period = "3600s" }
    auto_close = "1800s"
  }
  documentation {
    mime_type = "text/markdown"
    content   = "The five-minute publication-check-status Job observed undelivered dead letters. Inspect the current count and recover the event using [the operator runbook](https://github.com/mokly-ai/mokly/blob/main/docs/ops/check-recovery.md). A closed incident alone does not prove recovery; verify the same event was delivered."
    links {
      display_name = "Publication check recovery"
      url          = "https://github.com/mokly-ai/mokly/blob/main/docs/ops/check-recovery.md"
    }
  }
}

resource "google_monitoring_alert_policy" "billing_dead_letters" {
  project               = var.project
  display_name          = "mkc-${var.environment}: undelivered billing deliveries"
  combiner              = "OR"
  enabled               = true
  notification_channels = var.notification_channels
  conditions {
    display_name = "Undelivered billing delivery dead-letter count is positive"
    condition_matched_log {
      filter = "resource.type=\"k8s_container\" AND resource.labels.namespace_name=\"mkc-${var.environment}\" AND resource.labels.container_name=\"maintenance\" AND jsonPayload.fields.message=\"billing delivery status\" AND jsonPayload.fields.dead_letter_count>0"
    }
  }
  alert_strategy {
    notification_rate_limit { period = "3600s" }
    auto_close = "1800s"
  }
  documentation {
    mime_type = "text/markdown"
    content   = "The five-minute billing-delivery-status Job observed undelivered billing deliveries. Inspect the event and requeue it with `mkc-api requeue-billing-delivery --event <id>` using [the billing smoke runbook](https://github.com/mokly-ai/mokly/blob/main/docs/ops/billing-smoke.md)."
    links {
      display_name = "Billing delivery recovery"
      url          = "https://github.com/mokly-ai/mokly/blob/main/docs/ops/billing-smoke.md"
    }
  }
}
