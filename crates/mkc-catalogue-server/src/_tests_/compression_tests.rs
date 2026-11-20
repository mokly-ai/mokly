//! Exact MIME, status, cache and RFC quality-value negotiation.

#![allow(clippy::unwrap_used)]

use crate::catalogue::FileFraming;

use super::{Coding, negotiate};

fn coding(accept: Option<&str>, content_type: &str) -> Coding {
    negotiate(
        accept,
        200,
        FileFraming::Full(1025),
        "no-cache",
        content_type,
    )
}

#[test]
fn exact_text_and_structured_mime_set_is_compressible() {
    for content_type in [
        "text/plain",
        "Text/HTML; Charset=UTF-8",
        "application/json",
        "APPLICATION/JAVASCRIPT",
        "application/xml; charset=utf-8",
        "application/problem+json",
        "application/atom+xml",
        "application/manifest+json",
        "image/svg+xml",
    ] {
        assert_eq!(coding(Some("br"), content_type), Coding::Brotli);
    }
}

#[test]
fn binary_and_unlisted_mime_types_stay_identity_encoded() {
    for content_type in [
        "application/octet-stream",
        "application/x-javascript",
        "application/zip",
        "image/png",
        "image/jpeg",
        "audio/mpeg",
        "video/mp4",
        "font/woff2",
        "text",
    ] {
        assert_eq!(coding(Some("br, gzip"), content_type), Coding::Identity);
    }
}

#[test]
fn only_large_public_full_representations_are_compressible() {
    for (status, framing, cache) in [
        (200, FileFraming::Full(1024), "no-cache"),
        (200, FileFraming::Full(1025), "private, no-store"),
        (
            206,
            FileFraming::Partial(
                mkc_file_store_interface::stream::ByteRange::new(0, 9, 1025).unwrap(),
            ),
            "no-cache",
        ),
        (404, FileFraming::Full(1025), "no-store"),
    ] {
        assert_eq!(
            negotiate(Some("br"), status, framing, cache, "application/json"),
            Coding::Identity
        );
    }
    assert_eq!(
        negotiate(
            Some("br"),
            304,
            FileFraming::NotModified(1025),
            "no-cache",
            "application/json"
        ),
        Coding::Brotli
    );
}

#[test]
fn quality_values_wildcards_and_ties_choose_one_representation() {
    for (accept, expected) in [
        ("gzip, br", Coding::Brotli),
        ("gzip;q=1, br;q=0.5", Coding::Gzip),
        ("br;q=0.5", Coding::Identity),
        ("identity;q=0, *;q=0.4", Coding::Brotli),
        ("*;q=0, gzip;q=0.7", Coding::Gzip),
        ("br;q=0, gzip;q=0", Coding::Identity),
    ] {
        assert_eq!(
            coding(Some(accept), "application/json"),
            expected,
            "{accept}"
        );
    }
}

#[test]
fn refusing_every_supported_coding_falls_back_to_identity() {
    for accept in [
        "identity;q=0",
        "*;q=0",
        "gzip;q=0, br;q=0, identity;q=0",
        "gzip;q=0, br;q=0, *;q=0",
    ] {
        assert_eq!(coding(Some(accept), "application/json"), Coding::Identity);
    }
}
