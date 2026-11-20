//! Exact host scope and one-time decoding of catalogue filenames.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use mkc_domain::ids::PublicationId;
use mkc_publications::locations::Locations;
use uuid::Uuid;

use crate::routes::{Host, host, path};

fn locations() -> Locations {
    Locations {
        app_origin: "https://app.example.com".into(),
        catalogue_domain: "br-main.preview.example.net".into(),
        catalogue_scheme: "https".into(),
        catalogue_port: None,
    }
}

#[test]
fn canonical_hosts_reject_foreign_suffixes_ports_and_noncanonical_uuids() {
    let id = PublicationId(Uuid::from_u128(7));
    assert_eq!(
        host(&locations().authority(id), &locations()).unwrap(),
        Host::Publication(id)
    );
    let branch = format!("b-{}", "a".repeat(40));
    assert_eq!(
        host(
            &format!("{branch}.br-main.preview.example.net"),
            &locations(),
        )
        .unwrap(),
        Host::Branch(branch)
    );
    for value in [
        "br-main.preview.example.net",
        "app.example.com",
        "p-00000000000000000000000000000007.br-main.preview.example.net",
        "p-00000000-0000-0000-0000-000000000007.br-main.preview.example.net.evil",
        "p-00000000-0000-0000-0000-000000000007.br-main.preview.example.net:99",
        "p-00000000-0000-0000-0000-000000000007.pr-42.preview.example.net",
        "b-abc.br-main.preview.example.net",
        "a.b.br-main.preview.example.net",
    ] {
        assert!(host(value, &locations()).is_err(), "{value}");
    }
}

#[test]
fn unsafe_paths_fail_and_ordinary_export_filenames_decode_exactly_once() {
    for invalid in [
        "relative",
        "//host",
        "/a//b",
        "/%2e%2e/secret",
        "/a%2fb",
        "/a%5cb",
        "/%00",
        "/%FF",
        "/%xy",
        "/x%",
        "/a:b",
        "/./a",
    ] {
        assert!(path(invalid).is_err(), "{invalid}");
    }
    for (request, expected) in [
        ("/", ""),
        ("/id/a/", "id/a/"),
        ("/view/a.html", "view/a.html"),
        ("/static/a%20b.png", "static/a b.png"),
        ("/static/%252f.png", "static/%2f.png"),
    ] {
        assert_eq!(path(request).unwrap(), expected);
    }
}
