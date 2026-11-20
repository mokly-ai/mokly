// Retain the old repository bindings while public repository trust is added.
moved {
  from = google_service_account_iam_member.github["apply/deploy"]
  to   = google_service_account_iam_member.github["mokly-ai/mokly-cloud/apply/deploy"]
}
moved {
  from = google_service_account_iam_member.github["deploy/deploy"]
  to   = google_service_account_iam_member.github["mokly-ai/mokly-cloud/deploy/deploy"]
}
moved {
  from = google_service_account_iam_member.github["deploy/preview"]
  to   = google_service_account_iam_member.github["mokly-ai/mokly-cloud/deploy/preview"]
}
moved {
  from = google_service_account_iam_member.github["foundation/foundation"]
  to   = google_service_account_iam_member.github["mokly-ai/mokly-cloud/foundation/foundation"]
}
moved {
  from = google_service_account_iam_member.github["plan/ci"]
  to   = google_service_account_iam_member.github["mokly-ai/mokly-cloud/plan/ci"]
}
moved {
  from = google_service_account_iam_member.github["plan/deploy"]
  to   = google_service_account_iam_member.github["mokly-ai/mokly-cloud/plan/deploy"]
}
moved {
  from = google_service_account_iam_member.github["plan/foundation"]
  to   = google_service_account_iam_member.github["mokly-ai/mokly-cloud/plan/foundation"]
}
moved {
  from = google_service_account_iam_member.github["postmark/deploy"]
  to   = google_service_account_iam_member.github["mokly-ai/mokly-cloud/postmark/deploy"]
}
