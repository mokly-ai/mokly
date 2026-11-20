//! Reason uniqueness, documentation alignment, typed context and redaction.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::collections::BTreeMap;

use mkc_domain::values::{self, Plan};
use mkc_publications::error::Error as PublicationError;
use rpc_error::{RpcError, validate_unique_reasons};

use crate::error::ApiError;
use crate::error_data::PlanRequired;
use crate::platform::error::Error;

#[test]
fn every_reason_is_unique_and_matches_the_rest_catalogue() {
    validate_unique_reasons(&ApiError::reason_catalogs()).unwrap();
    let docs = include_str!("../../../../docs/protocol/cloud/rest-api.md");
    let documented: BTreeMap<_, _> = docs
        .lines()
        .filter(|s| s.starts_with("| `"))
        .map(|row| {
            let fields: Vec<_> = row.split('|').map(str::trim).collect();
            (
                fields[1].trim_matches('`'),
                (
                    fields[2].trim_matches('`'),
                    fields[3].parse::<u16>().unwrap(),
                ),
            )
        })
        .collect();
    let implemented: BTreeMap<_, _> = ApiError::reason_catalogs()
        .into_iter()
        .flatten()
        .map(|entry| {
            (
                entry.reason,
                (
                    entry.code.as_str(),
                    match entry.reason {
                        "upload-unsupported-version" => 426,
                        "upload-timeout" => 408,
                        "upload-expired" => 410,
                        _ => entry.code.status_code_u16(),
                    },
                ),
            )
        })
        .collect();
    assert_eq!(documented, implemented);
}

#[test]
fn translations_preserve_only_public_context() {
    let conflict = RpcError::from(ApiError::from(Error::VersionConflict(9)));
    assert_eq!(conflict.status_code_u16(), 400);
    assert_eq!(conflict.output().error.data.unwrap()["currentVersion"], 9);
    let invalid = RpcError::from(ApiError::from(values::Error::Role));
    assert_eq!(invalid.reason(), "validation-failed");
    let invalid_seat = RpcError::from(ApiError::from(values::Error::SeatKind));
    assert_eq!(invalid_seat.reason(), "validation-failed");
    let internal = RpcError::from(ApiError::internal(values::Error::Visibility));
    assert_eq!(internal.status_code_u16(), 500);
    assert_eq!(internal.reason(), "internal-error");
    assert_eq!(internal.message(), "Please try again shortly.");
    assert!(internal.data().is_none());
    assert!(internal.log_record().report.contains("invalid visibility"));
    let limited = RpcError::from(ApiError::RateLimited(60));
    assert!(limited.data().is_none());
    let plan = RpcError::from(ApiError::PlanRequired(PlanRequired {
        required_plan: Plan::Team,
        feature: "private-projects".into(),
    }));
    assert_eq!(plan.status_code_u16(), 400);
    let data = plan.output().error.data.unwrap();
    assert_eq!(data["requiredPlan"], "team");
    assert_eq!(data["feature"], "private-projects");
}

#[test]
fn upload_capacity_failures_keep_their_public_status() {
    let unavailable = RpcError::from(ApiError::publication(PublicationError::Unavailable));
    assert_eq!(unavailable.status_code_u16(), 503);
    assert_eq!(unavailable.reason(), "upload-unavailable");
}
