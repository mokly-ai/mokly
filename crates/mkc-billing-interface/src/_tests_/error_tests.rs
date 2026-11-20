//! Provider request outcomes distinguish definite rejection from uncertainty.

use std::io;

use super::{Error, ProviderDetail, ProviderErrorCode, ProviderErrorType, RequestOutcome};

#[test]
fn handled_rejections_are_definite_request_outcomes() {
    for error in [
        Error::InvalidRequest {
            detail: ProviderDetail::none(),
        },
        Error::Unauthorized {
            detail: ProviderDetail::none(),
        },
        Error::PermissionDenied {
            detail: ProviderDetail::none(),
        },
        Error::NotFound {
            detail: ProviderDetail::none(),
        },
        Error::RateLimited {
            retry_after: 12,
            detail: ProviderDetail::none(),
        },
    ] {
        assert_eq!(error.request_outcome(), RequestOutcome::Rejected);
    }
}

#[test]
fn provider_detail_has_a_closed_type_and_validated_code() {
    for (value, expected) in [
        ("api_error", ProviderErrorType::ApiError),
        ("card_error", ProviderErrorType::CardError),
        ("idempotency_error", ProviderErrorType::IdempotencyError),
        (
            "invalid_request_error",
            ProviderErrorType::InvalidRequestError,
        ),
        ("future_error", ProviderErrorType::Unknown),
    ] {
        assert_eq!(ProviderErrorType::from_provider(value), expected);
    }
    let detail = ProviderDetail {
        error_type: Some(ProviderErrorType::from_provider("future_error")),
        code: ProviderErrorCode::new("account_invalid".to_owned()),
    };
    assert_eq!(detail.error_type, Some(ProviderErrorType::Unknown));
    assert_eq!(detail.to_string(), "type=unknown code=account_invalid");
    for invalid in ["", "UPPERCASE", "contains space", &"a".repeat(65)] {
        assert_eq!(ProviderErrorCode::new(invalid.to_owned()), None);
    }
    assert_eq!(ProviderDetail::none().to_string(), "type=none code=none");
}

#[test]
fn refusal_messages_render_only_the_sanitized_detail() {
    let detail = ProviderDetail {
        error_type: Some(ProviderErrorType::CardError),
        code: ProviderErrorCode::new("card_declined".to_owned()),
    };
    for (error, expected) in [
        (
            Error::InvalidRequest {
                detail: detail.clone(),
            },
            "[mkc-billing-interface/error] invalid request: type=card_error code=card_declined",
        ),
        (
            Error::Unauthorized {
                detail: detail.clone(),
            },
            "[mkc-billing-interface/error] unauthorized: type=card_error code=card_declined",
        ),
        (
            Error::PermissionDenied {
                detail: detail.clone(),
            },
            "[mkc-billing-interface/error] permission denied: type=card_error code=card_declined",
        ),
        (
            Error::NotFound {
                detail: detail.clone(),
            },
            "[mkc-billing-interface/error] not found: type=card_error code=card_declined",
        ),
        (
            Error::RateLimited {
                retry_after: 12,
                detail,
            },
            "[mkc-billing-interface/error] rate limited for 12 seconds: type=card_error code=card_declined",
        ),
    ] {
        assert_eq!(error.to_string(), expected);
    }
}

#[test]
fn outages_and_unhandled_failures_leave_the_request_outcome_unknown() {
    for error in [
        Error::Unavailable,
        Error::internal(io::Error::other("provider response was incomplete")),
    ] {
        assert_eq!(error.request_outcome(), RequestOutcome::Unknown);
    }
}
