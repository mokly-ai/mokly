variable "project" {
  type    = string
  default = "mokly-508518"
  validation {
    condition     = var.project == "mokly-508518"
    error_message = "This stack belongs to mokly-508518."
  }

}
variable "region" {
  type    = string
  default = "us-central1"
}
