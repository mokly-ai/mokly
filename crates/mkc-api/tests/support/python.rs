//! Validate captured smoke responses with the same helper as Rust HTTP tests.

use serde::Deserialize;
use serde_json::Value;

use crate::support::response_validation::validate;

#[derive(Deserialize)]
struct CapturedResponse {
    method: String,
    path: String,
    status: u16,
    body: Value,
}

pub(crate) fn validate_output(stdout: &[u8]) -> String {
    let text = String::from_utf8_lossy(stdout);
    let mut report = String::new();
    let mut count = 0;
    for line in text.lines() {
        if let Some(record) = line.strip_prefix("CONTRACT_CAPTURE ") {
            let record: CapturedResponse = serde_json::from_str(record).unwrap();
            validate(
                &record.method,
                &record.path,
                record.status,
                &serde_json::to_vec(&record.body).unwrap(),
            );
            count += 1;
        } else {
            report.push_str(line);
            report.push('\n');
        }
    }
    assert!(count > 0, "Python smoke must exercise response validation");
    report.push_str(&format!(
        "Validated {count} JSON responses from the Python smoke.\n"
    ));
    report
}
