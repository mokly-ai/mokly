//! Real Git repositories in temporary directories for the fingerprint
//! adapter tests, with an empty global Git configuration.

use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};

use tempfile::TempDir;

use crate::remote::git_test_runner::IsolatedGit;
use crate::source_tree::error::Result;
use crate::source_tree::scan::read_source_tree;
use crate::source_tree::system::SystemTree;

/// One repository whose fixture Git commands ignore developer configuration.
pub(super) struct TreeFixture {
    directory: TempDir,
    git: IsolatedGit,
}

impl TreeFixture {
    /// A repository with one committed `file.txt`.
    pub(super) fn committed() -> Self {
        let fixture = Self::empty();
        fixture.write("file.txt", "hello\n");
        fixture.commit();
        fixture
    }

    /// A repository without commits. Its own configuration replaces the
    /// developer's global excludes file for the production Git reads.
    pub(super) fn empty() -> Self {
        let directory = TempDir::new().unwrap();
        let git = IsolatedGit::new(directory.path());
        let fixture = Self { directory, git };
        fs::create_dir(fixture.root()).unwrap();
        fixture.git(&["init", "-q", "--initial-branch=main"]);
        fixture.git(&["config", "user.name", "Fingerprint Fixture"]);
        fixture.git(&["config", "user.email", "fingerprint@example.invalid"]);
        fixture.git(&["config", "commit.gpgsign", "false"]);
        let excludes = fixture.directory.path().join("empty-global.gitconfig");
        fixture.git(&["config", "core.excludesFile", &excludes.to_string_lossy()]);
        fixture
    }

    /// The repository root.
    pub(super) fn root(&self) -> PathBuf {
        self.directory.path().join("repository")
    }

    /// The fixture's temporary directory outside the repository.
    pub(super) fn outside(&self) -> &Path {
        self.directory.path()
    }

    /// Run Git in the repository and return its trimmed output.
    pub(super) fn git(&self, args: &[&str]) -> String {
        self.git.run(&self.root(), args).trim().to_owned()
    }

    /// Run Git in another directory and return its trimmed output.
    pub(super) fn git_in(&self, cwd: &Path, args: &[&str]) -> String {
        self.git.run(cwd, args).trim().to_owned()
    }

    /// The path of a repository-relative name.
    pub(super) fn path(&self, name: &str) -> PathBuf {
        self.root().join(name)
    }

    /// Write a file with mode 644, creating its parent directories.
    pub(super) fn write(&self, name: &str, contents: &str) {
        let file = self.path(name);
        fs::create_dir_all(file.parent().unwrap()).unwrap();
        fs::write(&file, contents).unwrap();
        fs::set_permissions(&file, fs::Permissions::from_mode(0o644)).unwrap();
    }

    /// Stage everything, commit, and return the new `HEAD`.
    pub(super) fn commit(&self) -> String {
        self.git(&["add", "-A"]);
        self.git(&["commit", "-q", "-m", "test: fingerprint tree"]);
        self.git(&["rev-parse", "HEAD"])
    }

    /// The box state after a Testbox sync: the working tree of a commit
    /// with `HEAD` and the index at `base`.
    pub(super) fn box_state(&self, base: &str) {
        self.commit();
        self.git(&["reset", "-q", "--soft", base]);
        self.git(&["read-tree", base]);
    }

    /// Create a nested repository with one commit at `name`.
    pub(super) fn nested(&self, name: &str) {
        let target = self.path(name);
        fs::create_dir_all(&target).unwrap();
        self.git_in(&target, &["init", "-q", "--initial-branch=nested"]);
        self.git_in(&target, &["config", "user.name", "Nested Fixture"]);
        self.git_in(&target, &["config", "user.email", "nested@example.invalid"]);
        fs::write(target.join("file"), "nested\n").unwrap();
        self.git_in(&target, &["add", "file"]);
        self.git_in(&target, &["commit", "-q", "-m", "test: nested tree"]);
    }

    /// The fingerprint of the working tree.
    pub(super) fn fingerprint(&self) -> Result<String> {
        Ok(read_source_tree(&SystemTree, &self.root())?.to_string())
    }
}
