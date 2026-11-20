//! Safe input construction and secret diagnostics.

#![allow(clippy::unwrap_used)]

use mkc_domain::ids::ProjectId;
use uuid::Uuid;

use crate::error::{Error, RequestField};
use crate::input::{Branch, ConfigPath, HeadSha, Repository, UploadEndpoint};
use crate::secret::Secret;

#[test]
fn validates_all_direct_argument_inputs() {
    assert!(Repository::new("mokly-ai/mokly").is_ok());
    for value in [
        "owner",
        "../name",
        "owner/name/extra",
        "https://github.com/o/n",
    ] {
        assert!(matches!(
            Repository::new(value),
            Err(Error::InvalidRequest {
                field: RequestField::Repository
            })
        ));
    }
    for value in ["main", "feature/cloud-builds", "build's-branch"] {
        assert!(Branch::new(value).is_ok());
    }
    for value in [
        "-option",
        "",
        "HEAD..main",
        "a@{b",
        "a b",
        "a\nb",
        "a//b",
        "a.lock",
        ".main",
        "a.",
        "@",
        "a\\b",
    ] {
        assert!(Branch::new(value).is_err(), "{value:?}");
    }
    for size in [40, 64] {
        assert!(HeadSha::new("a".repeat(size)).is_ok());
    }
    for value in ["--option", "a", "A".repeat(40).as_str()] {
        assert!(HeadSha::new(value).is_err());
    }
    assert!(ConfigPath::new("docs/mokly.config.json").is_ok());
    for value in [
        "/config.json",
        "../config.json",
        "a/../config.json",
        "--config.json",
        "config.ts",
    ] {
        assert!(ConfigPath::new(value).is_err());
    }
}

#[test]
fn endpoint_belongs_to_one_project_and_has_no_credentials() {
    let project = ProjectId(Uuid::from_u128(11));
    let value = format!("https://api.mokly.ai/v1/projects/{project}/publications");
    assert!(UploadEndpoint::new(&value, project).is_ok());
    assert!(UploadEndpoint::new(&value.replace("https:", "http:"), project).is_ok());
    for value in [
        value.clone() + "?token=secret",
        value.clone() + "#fragment",
        value.replace("api.mokly.ai", "user:secret@api.mokly.ai"),
        value.replace("publications", "builds"),
    ] {
        assert!(UploadEndpoint::new(&value, project).is_err());
    }
}

#[test]
fn credential_validation_never_echoes_its_value() {
    let token = "ghs_secretToken123";
    let secret = Secret::new(token).unwrap();
    assert_eq!(format!("{secret:?}"), "[redacted]");
    assert_eq!(secret.expose(), token);
    for value in [
        "",
        "secret\ncredential",
        "a:b",
        "a@b",
        "a\0b",
        "padded secret",
    ] {
        let error = Secret::new(value).unwrap_err();
        assert!(!format!("{error:?}").contains("secret"));
    }
}
