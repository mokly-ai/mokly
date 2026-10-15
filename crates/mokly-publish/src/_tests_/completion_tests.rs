//! Optional Complete data never changes a known successful publication.

use bytes::Bytes;
use serde_json::json;

use crate::accounting::{Progress, Receipt};
use crate::completion::{Completion, Outcome};
use crate::error::Error;
use crate::http::{Body, Response};
use crate::settings::Token;
use crate::validation::RESPONSE_LIMIT;

use super::support::response;

#[test]
fn optional_url_is_normalized_and_omitted_when_unusable_or_secret_bearing() {
    let token = Token::new("secret/a==".to_owned()).unwrap();
    for (input, expected) in [
        (
            "https://EXAMPLE.com:443/a/../catalogue",
            Some("https://example.com/catalogue"),
        ),
        ("https://example.com/catalogue?secret/a==", None),
        ("https://example.com/catalogue?secret%2Fa%3D%3D", None),
        ("javascript:alert(1)", None),
        ("/relative", None),
        ("file:///catalogue", None),
    ] {
        let body = serde_json::to_vec(&json!({"viewerUrl":input})).unwrap();
        let response = Response {
            body: Body::Bytes(body.into()),
            ..response(201)
        };
        assert_eq!(
            Completion::parse(&response, &token)
                .unwrap()
                .viewer_url
                .as_deref(),
            expected
        );
    }
    for body in [
        Body::Unreadable,
        Body::Oversized,
        Body::Bytes(Bytes::from(vec![b' '; RESPONSE_LIMIT + 1])),
        Body::Bytes(b"[]".as_slice().into()),
        Body::Bytes(b"not-json".as_slice().into()),
        Body::Bytes(b"{\"viewerUrl\":42}".as_slice().into()),
    ] {
        let response = Response {
            body,
            ..response(200)
        };
        let result = Completion::parse(&response, &token).unwrap();
        assert_eq!(result.outcome, Outcome::AlreadyPublished);
        assert!(result.viewer_url.is_none());
    }
    for status in [202, 204, 206, 300, 404] {
        assert!(matches!(
            Completion::parse(&response(status), &token),
            Err(Error::Failed)
        ));
    }
}

#[test]
fn counted_and_progress_copy_has_exact_units_singular_and_plural() {
    for (uploaded, noun) in [(0, "files"), (1, "file"), (2, "files")] {
        let receipt = Receipt {
            completion: Completion {
                outcome: Outcome::Published,
                viewer_url: None,
            },
            uploaded,
            unchanged: 7,
        };
        assert_eq!(
            receipt.summary(),
            format!("Published Mokly catalogue. {uploaded} {noun} uploaded, 7 unchanged.")
        );
    }
    for (size, label) in [
        (0, "0 B"),
        (312, "312 B"),
        (1023, "1023 B"),
        (1024, "1.0 KiB"),
        (4198, "4.1 KiB"),
        (1_048_576, "1.0 MiB"),
    ] {
        assert_eq!(
            Progress {
                round: 0,
                completed: 0,
                total: 1,
                size
            }
            .label(),
            format!("Uploading 0 of 1 file · {label}")
        );
        assert_eq!(
            Progress {
                round: 0,
                completed: 2,
                total: 4,
                size
            }
            .label(),
            format!("Uploading 2 of 4 files · {label}")
        );
    }
}
