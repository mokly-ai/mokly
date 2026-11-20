resource "google_compute_security_policy" "workloads" {
  project     = var.project
  name        = "mkc-${var.environment}"
  description = "Bound public request load before it reaches workload pods."
  rule {
    priority = 1000
    action   = "throttle"
    match {
      expr { expression = "request.path == '/v1/health'" }
    }
    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"
      rate_limit_threshold {
        count        = 300
        interval_sec = 60
      }
    }
    description = "Health: 300 requests per source IP per minute; Cloudflare edges share the budget."
  }
  rule {
    priority = 2147483647
    action   = "allow"
    match {
      versioned_expr = "SRC_IPS_V1"
      config { src_ip_ranges = ["*"] }
    }
    description = "Required default rule."
  }
}
