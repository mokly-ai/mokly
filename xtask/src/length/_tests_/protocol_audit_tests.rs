//! The cap ratchet over real Git repositories: the comparison table, the
//! legacy table, renames, and a moved `origin/main`.

use std::fs;
use std::path::PathBuf;

use tempfile::TempDir;

use crate::length::error::Error;
use crate::remote::git_test_runner::IsolatedGit;

use super::audit_protocol_caps;

const LABEL: &str = "xtask/protocol-document-caps.json";
const LEGACY_TABLE: &str = "tests/protocol_doc_sizes.test.ts";
const LONG_DOCUMENT: &str = "docs/protocol/long.md";

/// A fixture repository in a temporary directory.
struct Fixture {
    directory: TempDir,
    git: IsolatedGit,
}

impl Fixture {
    fn new(branch: &str) -> Self {
        let directory = TempDir::new().unwrap();
        let git = IsolatedGit::new(directory.path());
        let fixture = Self { directory, git };
        fs::create_dir(fixture.root()).unwrap();
        fixture.run(&["init", "-q", "-b", branch]);
        fixture.run(&["config", "user.name", "Mokly Test"]);
        fixture.run(&["config", "user.email", "mokly@example.invalid"]);
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
        self.run(&["add", "--all"]);
        self.run(&["commit", "-qm", message]);
    }

    fn findings(&self) -> Vec<String> {
        audit_protocol_caps(&self.root()).unwrap().0
    }
}

fn lines(count: usize) -> String {
    "line\n".repeat(count)
}

/// A long page capped at 251 lines on the branch point. `origin/main` then
/// shortens it and drops the cap, while `feature` keeps both.
fn diverged_repository() -> Fixture {
    let fixture = Fixture::new("feature");
    let long = format!("# Long contract\n{}", "contract line\n".repeat(250));
    fixture.write(LONG_DOCUMENT, &long);
    fixture.write(
        "docs/protocol/fixtures/ignored.md",
        &"fixture line\n".repeat(400),
    );
    fixture.write(LABEL, "{ \"long.md\": 251 }\n");
    fixture.commit("test: branch point");
    fixture.run(&["branch", "main"]);
    fixture.write("feature.txt", "feature branch\n");
    fixture.commit("test: feature work");
    fixture.run(&["switch", "--quiet", "main"]);
    let shorter = format!("# Shorter contract\n{}", "contract line\n".repeat(249));
    fixture.write(LONG_DOCUMENT, &shorter);
    fixture.write(LABEL, "{}\n");
    fixture.commit("test: advance main");
    fixture.run(&["update-ref", "refs/remotes/origin/main", "HEAD"]);
    fixture.run(&["switch", "--quiet", "feature"]);
    fixture
}

#[test]
fn the_cap_ratchet_reads_the_legacy_table_at_an_older_comparison_commit() {
    let fixture = Fixture::new("main");
    fixture.write(LONG_DOCUMENT, &lines(270));
    fixture.write(
        LEGACY_TABLE,
        "const oversizedCaps = { \"long.md\": 260 };\n",
    );
    fixture.commit("comparison commit");
    fixture.run(&["update-ref", "refs/remotes/origin/main", "HEAD"]);
    fs::remove_file(fixture.root().join(LEGACY_TABLE)).unwrap();
    let missing = audit_protocol_caps(&fixture.root()).unwrap_err();
    assert!(matches!(missing, Error::CapTableMissing { .. }));
    assert!(
        missing
            .to_string()
            .ends_with(&format!("{LABEL} is missing"))
    );

    fixture.write(LONG_DOCUMENT, &lines(265));
    fixture.write(LABEL, "{ \"long.md\": 265 }\n");
    fixture.commit("JSON cap table");
    assert_eq!(
        fixture.findings(),
        ["long.md: cap 265 exceeds predecessor long.md cap 260"]
    );
    fixture.write(LONG_DOCUMENT, &lines(260));
    fixture.write(LABEL, "{ \"long.md\": 260 }\n");
    assert_eq!(fixture.findings(), Vec::<String>::new());
}

#[test]
fn the_cap_ratchet_prefers_the_json_table_at_the_comparison_commit() {
    let fixture = Fixture::new("main");
    fixture.write(LONG_DOCUMENT, &lines(280));
    fixture.write(LABEL, "{ \"long.md\": 260 }\n");
    fixture.write(
        LEGACY_TABLE,
        "const oversizedCaps = { \"long.md\": 270 };\n",
    );
    fixture.commit("comparison commit");
    fixture.run(&["update-ref", "refs/remotes/origin/main", "HEAD"]);
    fixture.write(LONG_DOCUMENT, &lines(265));
    fixture.write(LABEL, "{ \"long.md\": 265 }\n");
    assert_eq!(
        fixture.findings(),
        ["long.md: cap 265 exceeds predecessor long.md cap 260"]
    );
}

#[test]
fn the_cap_ratchet_stays_anchored_when_origin_main_moves() {
    let fixture = diverged_repository();
    let branch_point = fixture.run(&["rev-parse", "main~1"]);
    assert_eq!(
        fixture.run(&["merge-base", "HEAD", "origin/main"]),
        branch_point
    );
    let (findings, summary) = audit_protocol_caps(&fixture.root()).unwrap();
    assert_eq!(findings, Vec::<String>::new());
    assert_eq!(summary, "1 protocol document(s) and 1 cap(s)");
}

#[test]
fn moving_a_capped_protocol_document_into_a_subfolder_keeps_its_cap() {
    let fixture = diverged_repository();
    fs::create_dir_all(fixture.root().join("docs/protocol/nested")).unwrap();
    fs::rename(
        fixture.root().join(LONG_DOCUMENT),
        fixture.root().join("docs/protocol/nested/long.md"),
    )
    .unwrap();
    let longer = format!(
        "# Long contract\n{}one more line\n",
        "contract line\n".repeat(250)
    );
    fixture.write("docs/protocol/nested/long.md", &longer);
    fixture.write(LABEL, "{ \"nested/long.md\": 252 }\n");
    fixture.run(&["add", "--all"]);

    let findings = fixture.findings();
    assert!(
        findings
            .iter()
            .any(|finding| finding == "nested/long.md: cap 252 exceeds predecessor long.md cap 251"),
        "{findings:?}"
    );
}
