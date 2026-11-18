//! Allowlisted timing fields exclude source data and error payloads.

use serde_json::{Map, Value, json};
use tracing::field::{Field, Visit};

#[derive(Default)]
pub(super) struct Fields {
    pub(super) values: Map<String, Value>,
    pub(super) counts: Map<String, Value>,
    pub(super) error: bool,
    pub(super) cache_hit: bool,
    pub(super) sidecar_timing: Option<String>,
}
impl Visit for Fields {
    fn record_str(&mut self, field: &Field, value: &str) {
        match field.name() {
            "viewport" | "scheme" | "action" | "operation" | "side" => {
                self.values.insert(field.name().into(), json!(value));
            }
            "reason" if matches!(value, "recycle" | "replacement" | "retry" | "root-switch") => {
                self.values.insert(field.name().into(), json!(value));
            }
            "cache"
                if matches!(
                    value,
                    "no-record"
                        | "evicted"
                        | "stamp-mismatch"
                        | "inconsistent-evidence"
                        | "hit"
                        | "memory"
                        | "version-mismatch"
                        | "damaged"
                        | "unavailable"
                ) =>
            {
                self.values.insert(field.name().into(), json!(value));
            }
            "status" => self.error = value == "error",
            "sidecar_timing" => self.sidecar_timing = Some(value.to_owned()),
            _ => {}
        }
    }
    fn record_u64(&mut self, field: &Field, value: u64) {
        match field.name() {
            "views" | "unchanged" | "changed" | "ignored_only" | "uncaptured_views" => {
                let name = match field.name() {
                    "ignored_only" => "ignoredOnly",
                    "uncaptured_views" => "uncapturedViews",
                    name => name,
                };
                self.counts.insert(name.into(), json!(value));
            }
            "worker"
            | "tier"
            | "input_paths"
            | "read_bytes"
            | "retained_bytes"
            | "encoded_bytes"
            | "reused"
            | "compared"
            | "recorded_reads"
            | "identities_checked"
            | "identity_reads"
            | "peak_bytes"
            | "candidate_views"
            | "candidate_bytes"
            | "accepted_bytes"
            | "recording_identity_reads" => {
                let name = match field.name() {
                    "input_paths" => "inputPaths",
                    "read_bytes" => "readBytes",
                    "retained_bytes" => "retainedBytes",
                    "encoded_bytes" => "encodedBytes",
                    "recorded_reads" => "recordedReads",
                    "identities_checked" => "identitiesChecked",
                    "identity_reads" => "identityReads",
                    "peak_bytes" => "peakBytes",
                    "candidate_views" => "candidateViews",
                    "candidate_bytes" => "candidateBytes",
                    "accepted_bytes" => "acceptedBytes",
                    "recording_identity_reads" => "recordingIdentityReads",
                    name => name,
                };
                self.values.insert(name.into(), json!(value));
            }
            _ => {}
        }
    }

    fn record_f64(&mut self, field: &Field, value: f64) {
        let name = match field.name() {
            "revalidation_ms" => "revalidationMs",
            "recording_ms" => "recordingMs",
            "current_usage_ms" => "currentUsageMs",
            _ => return,
        };
        self.values.insert(name.into(), json!(value));
    }

    fn record_bool(&mut self, field: &Field, value: bool) {
        if field.name() == "overflowed" {
            self.values.insert("overflowed".into(), json!(value));
        }
        if field.name() == "cache_hit" {
            self.cache_hit = value;
        }
    }
    fn record_debug(&mut self, field: &Field, value: &dyn std::fmt::Debug) {
        if matches!(field.name(), "viewport" | "scheme" | "action") {
            self.record_str(field, &format!("{value:?}"));
        }
    }
}
