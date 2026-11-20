//! Expected client rejections warn; server failures remain errors.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::collections::BTreeSet;

use rpc_error::{RpcError, Severity};

use crate::error::ApiError;
use crate::error_samples::samples;

#[test]
fn every_error_has_the_status_appropriate_logging_severity() {
    let mut tested = BTreeSet::new();
    for sample in samples() {
        let rpc = RpcError::from(sample.error);
        let served = match rpc.reason() {
            "upload-unsupported-version" => 426,
            "upload-timeout" => 408,
            "upload-expired" => 410,
            _ => rpc.status_code_u16(),
        };
        let expected = if served < 500 {
            Severity::Warn
        } else {
            Severity::Error
        };
        assert_eq!(rpc.severity(), expected, "{}", rpc.reason());
        assert_eq!(rpc.log_record().severity, expected);
        tested.insert(rpc.reason().to_owned());
    }
    assert_eq!(
        tested,
        ApiError::reason_catalogs()
            .into_iter()
            .flatten()
            .map(|entry| entry.reason.to_owned())
            .collect()
    );
}
