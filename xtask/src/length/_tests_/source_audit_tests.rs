//! The changed-file length audit over real Git repositories in temporary
//! directories, with an empty global Git configuration.

use std::fs;
use std::path::{Path, PathBuf};

use tempfile::TempDir;

use crate::length::error::{Error, Result};
use crate::remote::git_test_runner::IsolatedGit;

use super::{SourceFileLengthAuditor, SystemSourceFileLengthAuditor};

/// One fixture repository whose first commit is also `origin/main`.
struct Fixture {
    directory: TempDir,
    git: IsolatedGit,
}

impl Fixture {
    fn new() -> Self {
        let directory = TempDir::new().unwrap();
        let git = IsolatedGit::new(directory.path());
        let fixture = Self { directory, git };
        fs::create_dir(fixture.root()).unwrap();
        fixture.git(&["init", "-q"]);
        fixture.git(&["config", "user.name", "Mokly Test"]);
        fixture.git(&["config", "user.email", "mokly@example.invalid"]);
        fixture
    }

    fn root(&self) -> PathBuf {
        self.directory.path().join("repository")
    }

    fn git(&self, args: &[&str]) -> String {
        self.git.run(&self.root(), args)
    }

    fn write(&self, file: &str, lines: usize) {
        self.write_text(file, &"x\n".repeat(lines));
    }

    fn write_text(&self, file: &str, contents: &str) {
        let path = self.root().join(file);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, contents).unwrap();
    }

    fn commit(&self, message: &str) {
        self.git(&["add", "."]);
        self.git(&["commit", "-qm", message]);
    }

    fn publish_main(&self) {
        self.git(&["update-ref", "refs/remotes/origin/main", "HEAD"]);
    }

    fn audit(&self, start: &Path, all: bool) -> Result<()> {
        SystemSourceFileLengthAuditor.run(start, all)
    }
}

/// The findings of a failed audit; fails when the audit passed.
fn findings(result: Result<()>) -> String {
    match result {
        Err(Error::SourceFileLength { details }) => details,
        other => panic!("expected length findings, got {other:?}"),
    }
}

#[test]
fn changed_and_untracked_source_and_protocol_files_enforce_their_separate_limits() {
    let fixture = Fixture::new();
    fixture.write("src/untouched.ts", 310);
    fixture.write("src/changed.ts", 1);
    fixture.commit("baseline");
    fixture.publish_main();
    fixture.write("src/changed.ts", 301);
    fixture.write("docs/protocol/new.md", 251);

    let changed = findings(fixture.audit(&fixture.root(), false));
    assert!(changed.contains("src/changed.ts: 301 lines (limit 300)"));
    assert!(changed.contains("docs/protocol/new.md: 251 lines (limit 250)"));
    assert!(!changed.contains("untouched.ts"));
    let all = findings(fixture.audit(&fixture.root(), true));
    assert!(all.contains("src/untouched.ts: 310 lines (limit 300)"));
}

#[test]
fn clean_committed_branch_changes_are_audited_against_origin_main() {
    let fixture = Fixture::new();
    fixture.write_text("README.md", "baseline\n");
    fixture.commit("baseline");
    fixture.publish_main();
    fixture.write("examples/oversize.mts", 301);
    fixture.write("docs/protocol/oversize.md", 251);
    fixture.commit("oversized branch files");

    let result = findings(fixture.audit(&fixture.root(), false));
    assert!(result.contains("examples/oversize.mts: 301 lines"));
    assert!(result.contains("docs/protocol/oversize.md: 251 lines"));
}

#[test]
fn staged_only_exact_limit_and_subdirectory_invocation_use_the_repository_root() {
    let fixture = Fixture::new();
    fixture.write_text("README.md", "baseline\n");
    fixture.commit("baseline");
    fixture.publish_main();
    fixture.write("packages/viewer/tests/exact.cts", 300);
    fixture.write("packages/viewer/scripts/long.jsx", 301);
    let new_scope_cases = [
        "examples/long.cts",
        "packages/viewer/tests/long.ts",
        "packages/viewer/tests/long.tsx",
        "packages/viewer/tests/long.js",
        "packages/viewer/tests/long.mjs",
        "packages/viewer/tests/long.cjs",
    ];
    for file in new_scope_cases {
        fixture.write(file, 301);
    }
    fixture.git(&["add", "."]);

    let start = fixture.root().join("packages/viewer");
    let changed = findings(fixture.audit(&start, false));
    assert!(changed.contains("packages/viewer/scripts/long.jsx: 301 lines"));
    for file in new_scope_cases {
        assert!(
            changed.contains(&format!("{file}: 301 lines")),
            "{file} is in scope"
        );
    }
    assert!(!changed.contains("exact.cts"));
    let all = findings(fixture.audit(&start, true));
    assert!(all.contains("packages/viewer/scripts/long.jsx"));
}

#[test]
fn an_in_progress_merge_audits_resolved_changes_not_untouched_main_additions() {
    let fixture = Fixture::new();
    fixture.write_text("README.md", "baseline\n");
    fixture.commit("baseline");
    fixture.git(&["branch", "feature"]);
    fixture.write("docs/protocol/main.md", 251);
    fixture.commit("main addition");
    fixture.publish_main();
    fixture.git(&["checkout", "-q", "feature"]);
    fixture.write_text("README.md", "feature\n");
    fixture.commit("feature change");
    fixture.git(&["merge", "--no-commit", "--no-ff", "origin/main"]);

    fixture.audit(&fixture.root(), false).unwrap();
    fixture.write("docs/protocol/feature.md", 251);
    let failed = findings(fixture.audit(&fixture.root(), false));
    assert!(failed.contains("docs/protocol/feature.md: 251 lines"));
    assert!(!failed.contains("main.md"));
}

#[test]
fn changed_protocol_pages_follow_exact_reviewed_caps() {
    let fixture = Fixture::new();
    let lines = |count: usize| "line\n".repeat(count);
    fixture.write_text("docs/protocol/long.md", &lines(260));
    fixture.write_text(
        "xtask/protocol-document-caps.json",
        "{ \"long.md\": 260 }\n",
    );
    fixture.commit("baseline cap");
    fixture.publish_main();

    fixture.write_text("docs/protocol/long.md", &lines(255));
    fixture.write_text(
        "xtask/protocol-document-caps.json",
        "{ \"long.md\": 255 }\n",
    );
    fixture
        .audit(&fixture.root(), false)
        .expect("a lowered exact cap permits a shorter capped page");

    fixture.write_text("docs/protocol/long.md", &lines(256));
    let above = findings(fixture.audit(&fixture.root(), false));
    assert!(
        above.contains("long.md: 256 lines (limit 255)"),
        "a page above its recorded cap fails"
    );

    fixture.write_text("docs/protocol/long.md", &lines(255));
    fixture.write_text("docs/protocol/uncapped.md", &lines(251));
    let uncapped = findings(fixture.audit(&fixture.root(), false));
    assert!(
        uncapped.contains("uncapped.md: 251 lines (limit 250)"),
        "an uncapped page above 250 fails"
    );

    fixture.write_text(
        "xtask/protocol-document-caps.json",
        "{ \"long.md\": 250 }\n",
    );
    let invalid = fixture.audit(&fixture.root(), false).unwrap_err();
    assert!(matches!(invalid, Error::CapTableValue { .. }));
    assert!(
        invalid
            .to_string()
            .contains("xtask/protocol-document-caps.json has an invalid cap for long.md"),
        "an invalid cap table stops the audit"
    );
}
