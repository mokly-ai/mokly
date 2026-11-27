//! Floating images and drifted consumer version sentences must fail.

use crate::policy::diagnostic::Violation;

use super::{e2b_base, failure_sentence};

#[test]
fn template_bases_require_a_tag_and_a_complete_digest() {
    let digest = "a".repeat(64);
    let valid = format!("FROM debian:trixie-slim@sha256:{digest}\n");
    assert_eq!(e2b_base(&valid), []);
    for invalid in [
        "FROM debian\n".to_owned(),
        "FROM debian:trixie-slim\n".to_owned(),
        format!("FROM debian@sha256:{digest}\n"),
        valid.replace(&digest, "short"),
        valid.replace(&digest, &"g".repeat(64)),
        valid.replace(&digest, &"A".repeat(64)),
        valid.replace("sha256", "sha512"),
        "ARG BASE=debian\nFROM $BASE\n".to_owned(),
        format!("{valid}FROM debian:trixie-slim\n"),
        String::new(),
    ] {
        assert!(!e2b_base(&invalid).is_empty(), "{invalid}");
    }
}

#[test]
fn template_rejects_the_previous_base_with_a_complete_digest() {
    let image = format!("e2bdev/base:latest@sha256:{}", "a".repeat(64));
    assert_eq!(
        e2b_base(&format!("FROM {image}\n")),
        [Violation::PinMismatch {
            path: "infra/e2b/build/e2b.Dockerfile".into(),
            field: "FROM".into(),
            expected: "debian:<tag>@sha256:<64 lowercase hex>".into(),
            actual: image,
        }],
    );
}

#[test]
fn failure_sentences_use_the_floor_in_markdown_and_typescript() {
    let source = "pub const MIN_MOKLY_VERSION: &str = \"0.18.0\";\n";
    for (path, sentence) in [
        (
            "docs/protocol/cloud/viewer-builds.md",
            "| `unsupported-mokly-version` | Update `@mokly/mokly` to 0.18.0 or later to publish. |\n",
        ),
        (
            "packages/app/src/viewer/build-copy.ts",
            "\"unsupported-mokly-version\":\n  \"Update `@mokly/mokly` to 0.18.0 or later to publish.\",\n",
        ),
        (
            "docs/mockups/src/fixtures/build-copy.ts",
            "\"unsupported-mokly-version\":\n  \"Update `@mokly/mokly` to 0.18.0 or later to publish.\",\n",
        ),
    ] {
        assert!(failure_sentence(path, sentence, source).is_empty());
        assert!(!failure_sentence(path, &sentence.replace("0.18.0", "0.17.0"), source).is_empty());
        assert!(!failure_sentence(path, &sentence.replace("0.18.0", "latest"), source).is_empty());
        assert!(!failure_sentence(path, "", source).is_empty());
        assert!(!failure_sentence(path, &format!("{sentence}{sentence}"), source).is_empty());
        assert!(!failure_sentence(path, sentence, "").is_empty());
    }
}
