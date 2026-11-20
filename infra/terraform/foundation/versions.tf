terraform {
  required_version = "= 1.16.2"
  required_providers {
    google = {
      source = "hashicorp/google", version = "= 8.3.0"
    }
    cloudflare = {
      source = "cloudflare/cloudflare", version = "= 5.25.0"
    }

  }

}
