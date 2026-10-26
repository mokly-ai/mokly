//! Guide version literals follow the package version and its release markers.

use std::collections::HashMap;

use regex::{Regex, escape};

use crate::support::read_text;

use super::pages::GUIDES;

const START: &str = "<!-- x-release-please-start-version -->";
const END: &str = "<!-- x-release-please-end -->";

#[test]
fn every_semantic_version_literal_equals_the_package_version() {
    let version = package_version();
    let literal = fancy_regex::Regex::new(r"(?<![0-9.])[0-9]+\.[0-9]+\.[0-9]+(?!\.[0-9])").unwrap();
    let mut found = Vec::new();
    for guide in GUIDES.iter() {
        for found_literal in literal.find_iter(&guide.body) {
            found.push((
                guide.id.as_str(),
                found_literal.unwrap().as_str().to_owned(),
            ));
        }
    }
    assert_eq!(
        found,
        [
            ("start/install", version.clone()),
            ("start/install", version.clone()),
            ("ci/github-action", version),
        ]
    );
}

#[test]
fn the_two_release_managed_files_bound_every_version_bearing_line() {
    let version = package_version();
    let escaped = escape(&version);
    let expected = HashMap::from([("start/install", 2), ("ci/github-action", 1)]);
    let bounded = Regex::new(&format!(r"\b{escaped}\b")).unwrap();
    for guide in GUIDES.iter() {
        let id = guide.id.as_str();
        let starts = guide.body.matches(START).count();
        let ends = guide.body.matches(END).count();
        assert_eq!(starts, expected.get(id).copied().unwrap_or(0), "{id}");
        assert_eq!(ends, starts, "{id}");
        for region in guide.body.split(START).skip(1) {
            let body = region.split(END).next().unwrap_or_default();
            assert!(bounded.is_match(body), "{id}");
        }
    }
    let install = GUIDES
        .iter()
        .find(|guide| guide.id == "start/install")
        .map(|guide| guide.body.as_str())
        .unwrap_or_default();
    for pattern in [
        format!("npm install --save-dev @mokly/mokly@{escaped}"),
        format!("describes version {escaped}"),
    ] {
        assert!(Regex::new(&pattern).unwrap().is_match(install), "{pattern}");
    }
}

/// The version of the root package manifest.
fn package_version() -> String {
    let manifest: serde_json::Value = serde_json::from_str(&read_text("package.json")).unwrap();
    manifest["version"]
        .as_str()
        .expect("package.json has a version")
        .to_owned()
}
