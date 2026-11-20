//! Stripe status classification and safe internal error context.

use mkc_billing_interface::error::{Error, ProviderDetail, ProviderErrorType, RequestOutcome};
use serde_json::json;

use crate::response;

use super::fixtures::response as fixture;

#[test]
fn documented_statuses_map_to_the_shared_error_contract() {
    assert!(matches!(
        response::checked(fixture("invalid-request")),
        Err(Error::InvalidRequest { .. })
    ));
    let mut unprocessable = fixture("invalid-request");
    unprocessable.status = 422;
    assert!(matches!(
        response::checked(unprocessable),
        Err(Error::InvalidRequest { .. })
    ));
    let mut unauthorized = fixture("invalid-request");
    unauthorized.status = 401;
    assert!(matches!(
        response::checked(unauthorized),
        Err(Error::Unauthorized { .. })
    ));
    assert!(matches!(
        response::checked(fixture("not-found")),
        Err(Error::NotFound { .. })
    ));
    assert!(matches!(
        response::checked(fixture("rate-limited")),
        Err(Error::RateLimited { retry_after: 2, .. })
    ));
    assert!(matches!(
        response::checked(fixture("unavailable")),
        Err(Error::Unavailable)
    ));
}

#[test]
fn unexpected_client_status_preserves_type_and_code_without_raw_body() {
    let mut unexpected = fixture("forbidden");
    unexpected.status = 418;
    let error = response::checked(unexpected).unwrap_err();
    assert!(matches!(error, Error::Internal(_)));
    let rendered = format!("{error}");
    assert!(rendered.contains("invalid_request_error"));
    assert!(rendered.contains("account_invalid"));
    assert!(!rendered.contains("Fixture raw account detail"));
}

#[test]
fn forbidden_is_a_definite_refusal_with_sanitized_type_and_code() {
    let error = response::checked(fixture("forbidden")).unwrap_err();
    assert_eq!(error.request_outcome(), RequestOutcome::Rejected);
    let Error::PermissionDenied { detail } = &error else {
        panic!("expected permission-denied refusal");
    };
    assert_eq!(
        detail.error_type,
        Some(ProviderErrorType::InvalidRequestError)
    );
    assert_eq!(
        detail.code.as_ref().map(|code| code.as_str()),
        Some("account_invalid")
    );
    let rendered = format!("{error}");
    assert!(rendered.contains("type=invalid_request_error"));
    assert!(rendered.contains("code=account_invalid"));
    assert!(!rendered.contains("Fixture raw account detail"));
}

#[test]
fn every_definite_refusal_status_decodes_the_sanitized_detail() {
    for status in [400, 422, 401, 403, 404, 429] {
        let mut refusal = fixture("forbidden");
        refusal.status = status;
        let error = response::checked(refusal).unwrap_err();
        let detail = match &error {
            Error::InvalidRequest { detail }
            | Error::Unauthorized { detail }
            | Error::PermissionDenied { detail }
            | Error::NotFound { detail }
            | Error::RateLimited { detail, .. } => detail,
            Error::Unavailable | Error::Internal(_) => {
                panic!("expected a definite refusal for status {status}")
            }
        };
        assert_eq!(
            detail.error_type,
            Some(ProviderErrorType::InvalidRequestError)
        );
        assert_eq!(
            detail.code.as_ref().map(|code| code.as_str()),
            Some("account_invalid")
        );
    }
}

#[test]
fn refusal_detail_sanitizes_unknown_types_and_unsafe_codes() {
    for code in ["UPPERCASE", "contains space", &"a".repeat(65)] {
        let detail = checked_detail(json!({
            "error": {"type": "future_error", "code": code, "message": "secret detail"}
        }));
        assert_eq!(detail.error_type, Some(ProviderErrorType::Unknown));
        assert_eq!(detail.code, None);
        assert_eq!(detail.to_string(), "type=unknown code=none");
    }
}

#[test]
fn absent_or_undecodable_refusal_detail_is_empty() {
    assert_eq!(checked_detail(json!({"error": {}})), ProviderDetail::none());
    let mut malformed = fixture("invalid-request");
    malformed.body = b"not-json".to_vec();
    let Error::InvalidRequest { detail } = response::checked(malformed).unwrap_err() else {
        panic!("expected invalid-request refusal");
    };
    assert_eq!(detail, ProviderDetail::none());
}

fn checked_detail(body: serde_json::Value) -> ProviderDetail {
    let mut refusal = fixture("invalid-request");
    refusal.body = serde_json::to_vec(&body).unwrap();
    let Error::InvalidRequest { detail } = response::checked(refusal).unwrap_err() else {
        panic!("expected invalid-request refusal");
    };
    detail
}

#[test]
fn malformed_or_zero_retry_after_uses_one_positive_second() {
    for value in ["0", "invalid"] {
        let mut response = fixture("rate-limited");
        response
            .headers
            .insert("retry-after".to_owned(), value.to_owned());
        assert_eq!(response::retry_after(&response), 1);
    }
    let mut response = fixture("rate-limited");
    response.headers.remove("retry-after");
    assert_eq!(response::retry_after(&response), 1);
}
