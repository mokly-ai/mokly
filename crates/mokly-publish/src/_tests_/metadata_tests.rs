//! Upload metadata grammar, nullable fields and finalization inputs.

use serde_json::{Value, json};

use crate::error::Error;
use crate::identity::{ActionsContext, Repository};
use crate::metadata::UploadMetadata;
use crate::settings::{Settings, Token};
use crate::validation::{portable_path, timestamp};

use super::support::{inventory, publication};

#[test]
fn publication_metadata_is_exact_bounded_and_round_trips() {
    for comparison in [false, true] {
        let metadata = publication().metadata(&inventory(comparison)).unwrap();
        let bytes = metadata.bytes().unwrap();
        assert_eq!(
            UploadMetadata::parse(&bytes).unwrap().base_sha.is_some(),
            comparison
        );
        let object: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(object.as_object().unwrap().len(), 11);
        for field in object.as_object().unwrap().keys() {
            let mut invalid = object.clone();
            invalid.as_object_mut().unwrap().remove(field);
            assert!(
                UploadMetadata::parse(&serde_json::to_vec(&invalid).unwrap()).is_err(),
                "missing {field}"
            );
        }
        let mut invalid = object.clone();
        invalid["extra"] = json!(true);
        assert!(UploadMetadata::parse(&serde_json::to_vec(&invalid).unwrap()).is_err());
        insta::assert_snapshot!(
            if comparison {
                "comparison_metadata"
            } else {
                "current_metadata"
            },
            String::from_utf8(bytes).unwrap()
        );
    }
}

#[test]
fn metadata_validates_each_primitive_and_comparison_pair() {
    let valid: Value = serde_json::from_slice(
        &publication()
            .metadata(&inventory(true))
            .unwrap()
            .bytes()
            .unwrap(),
    )
    .unwrap();
    for (field, value) in [
        ("moklyVersion", json!("not-semver")),
        ("moklyVersion", json!("v1.0.0")),
        ("branch", json!("bad\u{85}")),
        ("branch", json!("x".repeat(256))),
        ("headSha", json!("A".repeat(40))),
        ("headSha", json!("a".repeat(39))),
        ("baseRef", json!("")),
        ("baseSha", json!("tip")),
        ("pullRequest", json!(0)),
        ("pullRequest", json!(9_007_199_254_740_992_u64)),
        ("configPath", json!("../config.json")),
        ("exportedAt", json!("2026-02-30T00:00:00.000Z")),
        ("comparisonPath", json!("mokly-viewer/diffs/review.json")),
        ("comparisonPath", Value::Null),
    ] {
        let mut invalid = valid.clone();
        invalid[field] = value;
        assert!(
            UploadMetadata::parse(&serde_json::to_vec(&invalid).unwrap()).is_err(),
            "{field}"
        );
    }
    assert!(matches!(
        UploadMetadata::parse(&vec![b' '; 16 * 1024 + 1]),
        Err(Error::TooLarge)
    ));
    assert!(portable_path("format\u{200d}/é.png").is_ok());
    for value in [
        "2026-02-29T00:00:00.000Z",
        "2026-09-26T12:00:00Z",
        "2026-09-26T12:00:00.000+00:00",
        "2026-09-26T12:00:60.000Z",
    ] {
        assert!(timestamp(value).is_err());
    }
}

#[test]
fn repository_remotes_strip_credentials_and_one_git_suffix() {
    for value in [
        "https://user:password@EXAMPLE.com/group/sub/project.git",
        "ssh://git@example.com:2222/group/sub/project.git",
        "git@example.com:group/sub/project.git",
    ] {
        let repository = Repository::remote(value).unwrap();
        assert_eq!(repository.host, "example.com");
        assert_eq!(repository.owner, "group/sub");
        assert_eq!(repository.name, "project");
    }
    for value in [
        "/tmp/repository",
        "file:///tmp/repository",
        "https://example.com/group/../project",
        "https://example.com/group/project?private=1",
        "C:\\local\\repo",
    ] {
        assert!(Repository::remote(value).is_err(), "{value}");
    }
    for value in [
        "host:88/owner/repo",
        "host/../repo",
        "host/owner/.git",
        "host/owner/repo space",
        "host/owner/",
    ] {
        assert!(Repository::parse(value).is_err(), "{value}");
    }
    assert_eq!(
        Repository::parse("example.com/owner/project.git.git")
            .unwrap()
            .name,
        "project.git"
    );
}

#[test]
fn actions_context_is_used_only_for_actions_and_never_changes_the_head() {
    let mut actions = ActionsContext {
        head_ref: Some("pr".to_owned()),
        ref_type: Some("branch".to_owned()),
        ref_name: Some("branch".to_owned()),
        git_ref: Some("refs/pull/23/merge".to_owned()),
        ..Default::default()
    };
    assert_eq!(actions.branch("local"), "local");
    assert_eq!(actions.pull_request(), None);
    actions.actions = Some("true".to_owned());
    assert_eq!(actions.branch("local"), "pr");
    assert_eq!(actions.pull_request(), Some(23));
    actions.head_ref = None;
    assert_eq!(actions.branch("local"), "branch");
    actions.ref_type = None;
    assert_eq!(actions.branch(""), "HEAD");
    for value in [
        "refs/pull/0/head",
        "refs/pull/01/head",
        "refs/pull/23/other",
        "refs/pull/9007199254740992/head",
    ] {
        actions.git_ref = Some(value.to_owned());
        assert_eq!(actions.pull_request(), None, "{value}");
    }
}

#[test]
fn endpoint_and_token_validation_preserve_queries_without_echoing_secrets() {
    let settings = Settings::new(
        "https://api.example.com:443/custom/plan?x=1=2",
        "-secret/a==".to_owned(),
        32,
    )
    .unwrap();
    assert_eq!(
        settings.endpoint.as_str(),
        "https://api.example.com/custom/plan?x=1=2"
    );
    for endpoint in [
        "https://example.com/plan#",
        "https://example.com/plan#fragment",
        "https://user@example.com/plan",
        "file:///plan",
        "/plan",
    ] {
        assert!(Settings::new(endpoint, "secret".to_owned(), 1).is_err());
    }
    for token in ["", "=", "bad token", "token=bad", "bad\n"] {
        assert!(Token::new(token.to_owned()).is_err());
    }
    assert!(Settings::new("https://example.com/plan", "secret".to_owned(), 0).is_err());
    assert!(Settings::new("https://example.com/plan", "secret".to_owned(), 33).is_err());
    assert!(!format!("{:?}", settings.token).contains("secret"));
}

#[test]
fn json_numeric_versions_and_pull_request_integers_accept_decimal_spelling() {
    let bytes = publication()
        .metadata(&inventory(false))
        .unwrap()
        .bytes()
        .unwrap();
    let text = String::from_utf8(bytes)
        .unwrap()
        .replace("\"schemaVersion\": 2", "\"schemaVersion\": 2.0")
        .replace("\"pullRequest\": null", "\"pullRequest\": 1e0");
    assert_eq!(
        UploadMetadata::parse(text.as_bytes()).unwrap().pull_request,
        Some(1)
    );
}

#[test]
fn semver_does_not_add_a_numeric_component_limit() {
    let mut publication = publication();
    publication.mokly_version = format!("{}.0.0-beta.{}+build.001", "9".repeat(30), "9".repeat(30));
    assert!(publication.metadata(&inventory(false)).is_ok());
}

#[test]
fn semver_accepts_exact_identifiers_and_rejects_non_semver_spellings() {
    let mut publication = publication();
    for version in [
        "0.0.0",
        "1.2.3-alpha.0+build.001",
        "1.2.3--alpha",
        "1.2.3+001",
    ] {
        publication.mokly_version = version.to_owned();
        assert!(publication.metadata(&inventory(false)).is_ok(), "{version}");
    }
    for version in [
        "01.2.3",
        "1.02.3",
        "1.2.03",
        "1.2",
        "v1.2.3",
        "1.2.3-",
        "1.2.3-alpha..one",
        "1.2.3-01",
        "1.2.3+",
        "1.2.3+extra+more",
        "1.2.3+é",
    ] {
        publication.mokly_version = version.to_owned();
        assert!(
            publication.metadata(&inventory(false)).is_err(),
            "{version}"
        );
    }
}
