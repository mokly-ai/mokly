//! Read and check the `[mokly:timing]` records that `--debug-timings` prints.

use serde_json::Value;

/// The standard-error prefix of one timing record.
const PREFIX: &str = "[mokly:timing] ";

/// One timing record.
#[derive(Clone, Debug)]
pub struct Timing(pub Value);

impl Timing {
    /// The stage name, such as `config.load`.
    pub fn stage(&self) -> &str {
        self.0["stage"].as_str().unwrap()
    }

    /// The event: `start`, `end`, or `counts`.
    pub fn event(&self) -> &str {
        self.0["event"].as_str().unwrap()
    }

    /// The status of an `end` event: `ok` or `error`.
    pub fn status(&self) -> Option<&str> {
        self.0["status"].as_str()
    }

    /// The id of the parent span, when the record has one.
    pub fn parent_id(&self) -> Option<u64> {
        self.0["parentId"].as_u64()
    }

    /// The field `name`, or `Null` when the record has no such field.
    pub fn field(&self, name: &str) -> &Value {
        &self.0[name]
    }
}

/// The timing records in `stderr`, after a check of the common fields.
///
/// Panics when `stderr` has no record or when a record breaks the format.
pub fn timings(stderr: &str) -> Vec<Timing> {
    let records: Vec<_> = stderr
        .split('\n')
        .filter_map(|line| line.strip_prefix(PREFIX))
        .map(|line| Timing(serde_json::from_str(line).unwrap()))
        .collect();
    assert!(!records.is_empty(), "no timing records in: {stderr}");
    for Timing(record) in &records {
        assert_eq!(record["schemaVersion"], 1);
        assert!(
            record["session"]
                .as_str()
                .is_some_and(|session| !session.is_empty())
        );
        assert!(record["pid"].is_number());
        assert!(matches!(record["role"].as_str(), Some("core" | "sidecar")));
        assert!(record["stage"].is_string());
        assert!(record["id"].is_number());
        assert!(record["elapsedMs"].as_f64().is_some_and(f64::is_finite));
        let event = record["event"].as_str();
        assert!(matches!(event, Some("start" | "end" | "counts")));
        assert!(record.get("parentId").is_none_or(Value::is_number));
        if event == Some("end") {
            assert!(record["durationMs"].as_f64().is_some_and(f64::is_finite));
            assert!(matches!(record["status"].as_str(), Some("ok" | "error")));
        }
    }
    records
}

#[cfg(test)]
#[path = "_tests_/timings_tests.rs"]
mod timings_tests;
