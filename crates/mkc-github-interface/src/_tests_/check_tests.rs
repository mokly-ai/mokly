//! Provider responses classify retryable outages separately from rejections.

use std::io::{Error as IoError, ErrorKind};

use crate::check::Error;

#[test]
fn permanent_http_rejections_and_validation_are_distinct_from_outages() {
    for (status, rate_limited, permanent) in [
        (400, false, true),
        (401, false, true),
        (403, false, true),
        (404, false, true),
        (422, false, true),
        (408, false, false),
        (429, false, false),
        (403, true, false),
        (500, false, false),
        (502, false, false),
        (503, false, false),
        (504, false, false),
    ] {
        assert_eq!(
            Error::Http {
                status,
                rate_limited
            }
            .is_permanent(),
            permanent,
            "HTTP {status}, rate limit={rate_limited}"
        );
    }
    assert!(Error::Validation.is_permanent());
    for kind in [
        ErrorKind::TimedOut,
        ErrorKind::ConnectionReset,
        ErrorKind::ConnectionRefused,
    ] {
        assert!(
            !Error::internal(IoError::from(kind)).is_permanent(),
            "{kind:?}"
        );
    }
}
