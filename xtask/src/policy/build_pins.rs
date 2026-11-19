//! Build CLI, failure-sentence and sandbox template pin checks.

use semver::Version;
use serde::Deserialize;

use crate::error::{ErrorResultExt, Result};
use crate::policy::diagnostic::Violation;

use super::pins::compare;

#[derive(Deserialize)]
struct PackagePin {
    version: String,
}

pub(super) fn e2b_node(dockerfile: &str, nvmrc: &str) -> Vec<Violation> {
    let versions: Vec<_> = dockerfile
        .lines()
        .filter_map(|line| line.trim().strip_prefix("ARG NODE_VERSION="))
        .collect();
    if versions.len() != 1 {
        return vec![Violation::MissingPin("E2B template NODE_VERSION".into())];
    }
    compare(
        "infra/e2b/build/e2b.Dockerfile",
        "NODE_VERSION",
        nvmrc.trim(),
        versions[0],
    )
}

pub(super) fn mokly(package: &str, source: &str) -> Result<Vec<Violation>> {
    let pin: PackagePin = serde_json::from_str(package).context("parse cloud CLI package pin")?;
    let path = "crates/mkc-build-sandbox/src/versions.rs";
    let name = "MIN_MOKLY_VERSION";
    let values: Vec<_> = source
        .split("pub const ")
        .skip(1)
        .filter_map(|part| {
            let (declaration, value) = part.split_once('=')?;
            if declaration.split_once(':')?.0.trim() != name {
                return None;
            }
            value
                .split_once(';')?
                .0
                .trim()
                .strip_prefix('"')?
                .strip_suffix('"')
        })
        .collect();
    if values.len() != 1 {
        return Ok(vec![Violation::MissingPin(name.into())]);
    }
    let Ok(minimum) = Version::parse(values[0]) else {
        return Ok(compare(path, name, "exact SemVer", values[0]));
    };
    let mut violations = Vec::new();
    let version = Version::parse(&pin.version).context("parse workspace CLI version")?;
    if version.cmp_precedence(&minimum).is_lt() {
        violations.extend(compare(
            "packages/mokly/package.json",
            "version",
            &format!(">= {minimum}"),
            &pin.version,
        ));
    }
    Ok(violations)
}

/// A tagged base digest records both the immutable image and its release source.
pub(super) fn e2b_base(source: &str) -> Vec<Violation> {
    let path = "infra/e2b/build/e2b.Dockerfile";
    let mut count = 0;
    let mut violations = Vec::new();
    for line in source.lines() {
        let mut parts = line.split_whitespace();
        if !parts
            .next()
            .is_some_and(|part| part.eq_ignore_ascii_case("FROM"))
        {
            continue;
        }
        count += 1;
        let mut image = parts.next().unwrap_or_default();
        if image.starts_with("--platform=") {
            image = parts.next().unwrap_or_default();
        }
        let pinned = image.split_once("@sha256:").is_some_and(|(tag, digest)| {
            tag.strip_prefix("e2bdev/base:").is_some_and(|tag| {
                !tag.is_empty()
                    && tag
                        .bytes()
                        .all(|b| b.is_ascii_alphanumeric() || b"._-".contains(&b))
            }) && digest.len() == 64
                && digest
                    .bytes()
                    .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        });
        if !pinned {
            violations.extend(compare(
                path,
                "FROM",
                "e2bdev/base:<tag>@sha256:<64 lowercase hex>",
                image,
            ));
        }
    }
    if count == 0 {
        violations.push(Violation::MissingPin("E2B template FROM".into()));
    }
    violations
}

/// Read only the cause's own sentence, including a multi-line TypeScript value.
pub(super) fn failure_sentence(path: &str, text: &str, source: &str) -> Vec<Violation> {
    let minimum: Vec<_> = source
        .split("pub const ")
        .skip(1)
        .filter_map(|part| {
            let (declaration, value) = part.split_once('=')?;
            if declaration.split_once(':')?.0.trim() != "MIN_MOKLY_VERSION" {
                return None;
            }
            value
                .split_once(';')?
                .0
                .trim()
                .strip_prefix('"')?
                .strip_suffix('"')
        })
        .collect();
    if minimum.len() != 1 {
        return vec![Violation::MissingPin("MIN_MOKLY_VERSION".into())];
    }
    let sentences: Vec<_> = text
        .split("unsupported-mokly-version")
        .skip(1)
        .filter_map(|part| {
            let (_, value) = part.split_once("Update `@mokly/mokly` to ")?;
            let (version, _) = value.split_once(" or later to publish.")?;
            if version.contains(['\n', '|', '"']) {
                return None;
            }
            Some(version)
        })
        .collect();
    if sentences.len() != 1 {
        return vec![Violation::MissingPin(format!(
            "{path}: unsupported-mokly-version sentence"
        ))];
    }
    compare(
        path,
        "unsupported-mokly-version sentence",
        minimum[0],
        sentences[0],
    )
}

#[cfg(test)]
#[path = "_tests_/build_pins_tests.rs"]
mod tests;
