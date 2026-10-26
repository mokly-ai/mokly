//! The guide tree, front matter, bodies, and link destinations.

use std::collections::{BTreeSet, HashSet};
use std::fs;

use regex::Regex;
use url::Url;
use walkdir::WalkDir;

use super::pages::{GUIDE_SECTIONS, GUIDES, guides_root, without_fenced_code};

const EXPECTED: [&str; 33] = [
    "start/install",
    "start/configure",
    "start/your-first-screen",
    "start/build",
    "start/serve",
    "authoring/config",
    "authoring/screens",
    "authoring/components",
    "authoring/viewports-and-color-schemes",
    "authoring/collections-and-tags",
    "authoring/use-case-flows",
    "authoring/pages",
    "authoring/links",
    "authoring/review-ignore",
    "authoring/styles",
    "authoring/props-and-variants",
    "authoring/storybook",
    "catalogue/browse",
    "catalogue/search-and-filters",
    "catalogue/changes",
    "catalogue/details",
    "catalogue/export-and-host",
    "ci/github-action",
    "ci/publish-from-ci",
    "ci/project-tokens",
    "ci/the-upload",
    "ci/the-check-on-a-pull-request",
    "cli/serve",
    "cli/build",
    "cli/check",
    "cli/export",
    "cli/publish",
    "cli/options-and-exit-status",
];

const REFERENCE_SLUGS: [&str; 7] = [
    "export-delivery",
    "export-ownership",
    "upload",
    "upload-exchange",
    "navigation",
    "link-controls",
    "pages",
];

/// The largest integer that a JavaScript number holds exactly.
const MAX_SAFE_INTEGER: u64 = (1 << 53) - 1;

#[test]
fn the_guide_tree_contains_the_exact_guide_reading_order() {
    let ids: Vec<&str> = GUIDES.iter().map(|guide| guide.id.as_str()).collect();
    assert_eq!(ids, EXPECTED);
    let directories: BTreeSet<String> = fs::read_dir(guides_root())
        .unwrap()
        .map(Result::unwrap)
        .filter(|entry| entry.file_type().unwrap().is_dir())
        .map(|entry| entry.file_name().into_string().unwrap())
        .collect();
    let sections: BTreeSet<String> = GUIDE_SECTIONS
        .iter()
        .map(|section| (*section).to_owned())
        .collect();
    assert_eq!(directories, sections);
    let files = WalkDir::new(guides_root())
        .min_depth(1)
        .into_iter()
        .map(Result::unwrap)
        .filter(|entry| entry.file_type().is_file())
        .count();
    assert_eq!(files, 33);
}

#[test]
fn frontmatter_is_restricted_bounded_and_unique_within_each_section() {
    let slug = Regex::new(r"^[a-z0-9]+(?:-[a-z0-9]+)*$").unwrap();
    let mut orders = HashSet::new();
    for guide in GUIDES.iter() {
        let id = &guide.id;
        let frontmatter = &guide.frontmatter;
        assert!(slug.is_match(&guide.slug), "{id}");
        assert_eq!(
            Some(frontmatter.section.as_str()),
            id.split('/').next(),
            "{id}"
        );
        assert_eq!(frontmatter.title.trim(), frontmatter.title);
        assert!(!frontmatter.title.is_empty(), "{id}");
        assert_eq!(
            frontmatter.description.trim(),
            frontmatter.description,
            "{id}"
        );
        let length = frontmatter.description.chars().count();
        assert!((1..=180).contains(&length), "{id}");
        assert!(frontmatter.order <= MAX_SAFE_INTEGER, "{id}");
        assert!(frontmatter.order > 0, "{id}");
        let keys: Vec<&str> = guide
            .frontmatter_source
            .split('\n')
            .map(|line| line.split(':').next().unwrap_or_default())
            .collect();
        assert_eq!(keys, ["title", "description", "section", "order"], "{id}");
        let key = format!("{}:{}", frontmatter.section, frontmatter.order);
        assert!(orders.insert(key.clone()), "{key} is duplicated");
    }
}

#[test]
fn bodies_use_headings_comments_and_fenced_code_within_the_contract() {
    let opening_fence = Regex::new(r"^```[a-z][a-z0-9+-]*$").unwrap();
    let heading = Regex::new(r"^(#{1,6}) (.+)$").unwrap();
    let comment = Regex::new(r"<!--[\s\S]*?-->").unwrap();
    let code = Regex::new(r"`[^`]*`").unwrap();
    let tag = Regex::new(r"</?[A-Za-z][^>]*>").unwrap();
    let module_syntax = Regex::new(r"(?m)^\s*(?:import|export)\s").unwrap();
    for guide in GUIDES.iter() {
        let id = &guide.id;
        let mut headings = HashSet::new();
        let mut fenced = false;
        for line in guide.body.split('\n') {
            if line.starts_with("```") {
                if fenced {
                    assert_eq!(line, "```", "{id}");
                } else {
                    assert!(opening_fence.is_match(line), "{id}");
                }
                fenced = !fenced;
                continue;
            }
            if fenced {
                continue;
            }
            let Some(parts) = heading.captures(line) else {
                continue;
            };
            assert!(parts[1].len() >= 2, "{id}");
            assert_ne!(&parts[2], guide.frontmatter.title, "{id}");
            assert!(headings.insert(parts[2].to_owned()), "{id}: {}", &parts[2]);
        }
        assert!(!fenced, "{id} has an open fence");
        let prose = without_fenced_code(&guide.body);
        let prose = comment.replace_all(&prose, "");
        let prose = code.replace_all(&prose, "");
        assert!(!tag.is_match(&prose), "{id}");
        assert!(!module_syntax.is_match(&prose), "{id}");
    }
}

#[test]
fn guide_links_use_only_bounded_destinations() {
    let comment = Regex::new(r"<!--[\s\S]*?-->").unwrap();
    let link = Regex::new(r"!?\[[^\]]*\]\(([^\s)]+)[^)]*\)").unwrap();
    for guide in GUIDES.iter() {
        let prose = without_fenced_code(&guide.body);
        let prose = comment.replace_all(&prose, "");
        for destination in link.captures_iter(&prose) {
            assert!(
                allowed_link(&destination[1]),
                "{}: {}",
                guide.id,
                &destination[1]
            );
        }
    }
    for destination in [
        "/docs/authoring/screens/",
        "/docs/reference/upload-exchange/#export-files-and-limits",
        "/docs/",
        "/changelog/#v0100",
        "https://example.com/docs",
        "http://localhost:4173/docs",
    ] {
        assert!(allowed_link(destination), "{destination}");
    }
    for destination in [
        "../authoring/screens.md",
        "./screens.md",
        "/docs/cloud/overview/",
        "/docs/reference/private-contract/",
        "docs/protocol/mokly-upload.md",
        "file:///tmp/guide.md",
    ] {
        assert!(!allowed_link(destination), "{destination}");
    }
}

/// A guide destination: the docs and changelog roots, a guide, a public
/// reference page, or an absolute HTTP URL.
fn allowed_link(destination: &str) -> bool {
    let target = destination.split('#').next().unwrap_or_default();
    if target == "/docs/" || target == "/changelog/" {
        return true;
    }
    let guide =
        Regex::new(r"^/docs/(start|authoring|catalogue|ci|cli)/([a-z0-9]+(?:-[a-z0-9]+)*)/$")
            .unwrap();
    if guide.is_match(target) {
        return true;
    }
    let reference = Regex::new(r"^/docs/reference/([a-z0-9]+(?:-[a-z0-9]+)*)/$").unwrap();
    if let Some(page) = reference.captures(target) {
        return REFERENCE_SLUGS.contains(&&page[1]);
    }
    Url::parse(destination).is_ok_and(|url| matches!(url.scheme(), "http" | "https"))
}
