//! The binary under test, the comparison publication fixture, and shared checks.

use std::fs;
use std::io::ErrorKind;
use std::path::Path;

use mokly_test_support::changes::screen;
use mokly_test_support::files::write;
use mokly_test_support::git::{commit_all, git};
use mokly_test_support::process::Mokly;
use mokly_test_support::publication;
use tempfile::TempDir;

/// The image bytes at the base of the comparison fixture.
pub(super) const HISTORICAL_BINARY: [u8; 6] = [0, 255, 128, 13, 10, 1];

/// The image bytes at the head of the comparison fixture.
pub(super) const CURRENT_BINARY: [u8; 6] = [0, 254, 129, 13, 10, 2];

/// The `mokly` binary of this crate.
pub(super) fn mokly() -> Mokly {
    Mokly::new(env!("CARGO_BIN_EXE_mokly"))
}

/// A catalogue under `tools/` with a stylesheet, an image, and a removed entry.
pub(super) struct Comparison {
    pub(super) root: TempDir,
    pub(super) config: &'static str,
    pub(super) base: String,
    pub(super) head: String,
    pub(super) tip: String,
}

/// Create the comparison fixture with the branches `configured-base` and
/// `requested-base`, where `requested-base` advances past the merge base.
pub(super) fn comparison() -> Comparison {
    let root = publication::fixture(false, "sha1");
    let path = root.path();
    let config = "tools/mokly.config.json";
    fs::create_dir(path.join("tools")).unwrap();
    fs::rename(path.join("specs"), path.join("tools/specs")).unwrap();
    write(
        path,
        config,
        r#"{"repoRoot":"..","review":{"base":"configured-base"},"stylesheets":[{"match":"**","stylesheets":["theme.css"]}]}"#,
    );
    write(
        path,
        "tools/theme.css",
        r#"@import "./styles/child.css"; .hero{color:red}"#,
    );
    write(
        path,
        "tools/styles/child.css",
        r#".hero{background:url("./asset.png")}"#,
    );
    write(path, "tools/styles/asset.png", HISTORICAL_BINARY);
    write(
        path,
        "tools/specs/home.screen.html",
        screen(r#"<h1 class="hero">Before</h1>"#, ""),
    );
    write(
        path,
        "tools/specs/retired.screen.html",
        screen("<h1>Retired</h1>", ""),
    );
    commit_all(path, "historical publication");
    let base = git(path, &["rev-parse", "HEAD"]);
    git(path, &["branch", "configured-base"]);
    write(
        path,
        "tools/specs/home.screen.html",
        screen(r#"<h1 class="hero">After</h1>"#, ""),
    );
    write(
        path,
        "tools/theme.css",
        r#"@import "./styles/child.css"; .hero{color:blue}"#,
    );
    write(path, "tools/styles/asset.png", CURRENT_BINARY);
    fs::remove_file(path.join("tools/specs/retired.screen.html")).unwrap();
    commit_all(path, "current publication");
    let head = git(path, &["rev-parse", "HEAD"]);
    let tree = format!("{base}^{{tree}}");
    let tip = git(
        path,
        &["commit-tree", &tree, "-p", &base, "-m", "advanced base ref"],
    );
    git(path, &["branch", "requested-base", &tip]);
    Comparison {
        root,
        config,
        base,
        head,
        tip,
    }
}

/// Check the reservation namespace that a private publish root keeps.
pub(super) fn reservations(private_root: &Path) {
    assert_eq!(
        fs::read_to_string(private_root.join(".mokly-export-reservations/.owner")).unwrap(),
        "mokly-export-reservations-v1\n"
    );
    assert!(
        private_root
            .join(".mokly-export-reservations/locks")
            .is_dir()
    );
}

/// Check that nothing exists at `path`, also not a broken link.
pub(super) fn missing(path: &Path) {
    let error = fs::symlink_metadata(path).unwrap_err();
    assert_eq!(error.kind(), ErrorKind::NotFound, "{}", path.display());
}

/// Check that each label occurs in `text`, in order.
pub(super) fn in_order(text: &str, labels: &[&str]) {
    let mut previous = None;
    for label in labels {
        let position = text.find(label);
        assert!(position.is_some(), "{label} is missing from: {text}");
        assert!(position > previous, "{label} is out of order in: {text}");
        previous = position;
    }
}
