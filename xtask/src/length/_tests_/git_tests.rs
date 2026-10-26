//! The comparison commit and the changed files during merges, over real Git
//! repositories, and the length audit that uses them.

use std::fs;
use std::path::PathBuf;

use tempfile::TempDir;

use crate::length::error::{Error, Result};
use crate::length::source_audit::{SourceFileLengthAuditor, SystemSourceFileLengthAuditor};
use crate::remote::git_test_runner::IsolatedGit;

use super::GitWorkspace;

/// A `main` with one protocol page on `origin/main`, and a `feature` branch
/// with its own change from the first commit.
struct Fixture {
    directory: TempDir,
    git: IsolatedGit,
    base: String,
    main_tip: String,
}

impl Fixture {
    fn new() -> Self {
        let directory = TempDir::new().unwrap();
        let git = IsolatedGit::new(directory.path());
        let mut fixture = Self {
            directory,
            git,
            base: String::new(),
            main_tip: String::new(),
        };
        fs::create_dir(fixture.root()).unwrap();
        fixture.run(&["init", "-q", "-b", "main"]);
        fixture.run(&["config", "user.name", "Mokly Test"]);
        fixture.run(&["config", "user.email", "mokly@example.invalid"]);
        fixture.write("README.md", "baseline\n");
        fixture.commit("baseline");
        fixture.base = fixture.run(&["rev-parse", "HEAD"]);
        fixture.run(&["branch", "feature"]);
        fixture.write("docs/protocol/main.md", "main\n");
        fixture.commit("main contract");
        fixture.main_tip = fixture.run(&["rev-parse", "HEAD"]);
        fixture.run(&["update-ref", "refs/remotes/origin/main", &fixture.main_tip]);
        fixture.run(&["checkout", "-q", "feature"]);
        fixture.write("README.md", "feature\n");
        fixture.commit("feature change");
        fixture
    }

    fn root(&self) -> PathBuf {
        self.directory.path().join("repository")
    }

    fn run(&self, args: &[&str]) -> String {
        self.git.run(&self.root(), args).trim().to_owned()
    }

    fn write(&self, file: &str, contents: &str) {
        let path = self.root().join(file);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, contents).unwrap();
    }

    fn commit(&self, message: &str) {
        self.run(&["add", "."]);
        self.run(&["commit", "-qm", message]);
    }

    /// The comparison commit and the changed protocol files.
    fn inspect(&self) -> (String, Vec<String>) {
        let workspace = GitWorkspace::open(&self.root()).unwrap();
        let base = workspace.require_base().unwrap().to_owned();
        let mut files: Vec<String> = workspace
            .changed_files(&["docs/protocol"])
            .unwrap()
            .into_iter()
            .map(|change| change.path)
            .collect();
        files.sort();
        (base, files)
    }

    fn check_length(&self) -> Result<()> {
        SystemSourceFileLengthAuditor.run(&self.root(), false)
    }
}

#[test]
fn normal_and_main_merge_ratchets_use_their_respective_comparison_commits() {
    let fixture = Fixture::new();
    assert_eq!(fixture.inspect().0, fixture.base);
    fixture.check_length().unwrap();
    fixture.run(&["merge", "--no-commit", "--no-ff", "origin/main"]);
    assert_eq!(fixture.inspect(), (fixture.main_tip.clone(), Vec::new()));
    fixture.check_length().unwrap();

    let tree = fixture.run(&["rev-parse", &format!("{}^{{tree}}", fixture.main_tip)]);
    let next = fixture.run(&[
        "commit-tree",
        &tree,
        "-p",
        &fixture.main_tip,
        "-m",
        "main advanced",
    ]);
    fixture.run(&["update-ref", "refs/remotes/origin/main", &next]);
    let workspace = GitWorkspace::open(&fixture.root()).unwrap();
    assert!(matches!(workspace.require_base(), Err(Error::TargetMoved)));
    let moved = fixture.check_length().unwrap_err();
    assert!(
        moved
            .to_string()
            .contains("origin/main moved during the merge"),
        "{moved}"
    );
}

#[test]
fn merging_another_branch_keeps_the_normal_merge_base_rule() {
    let fixture = Fixture::new();
    fixture.run(&["checkout", "-q", "-b", "other", &fixture.base]);
    fixture.write("docs/protocol/other.md", "other\n");
    fixture.commit("other contract");
    fixture.run(&["checkout", "-q", "feature"]);
    fixture.run(&["merge", "--no-commit", "--no-ff", "other"]);
    assert_eq!(fixture.inspect().0, fixture.base);
    fixture.check_length().unwrap();
}

#[test]
fn merging_a_local_main_ahead_of_origin_main_does_not_claim_main_moved() {
    let fixture = Fixture::new();
    fixture.run(&["checkout", "-q", "main"]);
    fixture.write("docs/protocol/local.md", "local\n");
    fixture.commit("local main contract");
    fixture.run(&["checkout", "-q", "feature"]);
    fixture.run(&["merge", "--no-commit", "--no-ff", "main"]);
    let (base, files) = fixture.inspect();
    assert_eq!(base, fixture.base);
    assert_eq!(files, ["docs/protocol/local.md", "docs/protocol/main.md"]);
    fixture.check_length().unwrap();
}
