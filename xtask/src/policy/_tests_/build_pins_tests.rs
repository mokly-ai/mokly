//! Floating images and drifted consumer version sentences must fail.

use super::{e2b_base, failure_sentence};

#[test]
fn template_bases_require_a_tag_and_a_complete_digest() {
    let digest = "a".repeat(64);
    let valid = format!("FROM e2bdev/base:latest@sha256:{digest}\n");
    assert!(e2b_base(&valid).is_empty());
    for invalid in [
        "FROM e2bdev/base\n".to_owned(),
        "FROM e2bdev/base:latest\n".to_owned(),
        format!("FROM e2bdev/base@sha256:{digest}\n"),
        valid.replace(&digest, "short"),
        valid.replace(&digest, &"g".repeat(64)),
        valid.replace("sha256", "sha512"),
        "ARG BASE=e2bdev/base\nFROM $BASE\n".to_owned(),
        format!("{valid}FROM e2bdev/base:latest\n"),
        String::new(),
    ] {
        assert!(!e2b_base(&invalid).is_empty(), "{invalid}");
    }
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
            "apps/app/src/viewer/build-copy.ts",
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
