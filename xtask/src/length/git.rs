//! The read-only Git comparison of the length audits: the comparison commit,
//! the changed files, and the files of the comparison commit.

use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use std::sync::OnceLock;

use crate::child_environment::{GIT_REPOSITORY_VARIABLES, SECRET_VARIABLES};

use super::error::{Error, Result};

/// The branch that every comparison uses.
const TARGET: &str = "origin/main";

/// One changed path: its Git status letter, its path, and the source of a
/// rename or copy. Untracked files have the status `A?`.
#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct Change {
    /// The `git diff --name-status` letter, with any similarity score.
    pub(crate) status: String,
    /// The repository-relative path in the working tree.
    pub(crate) path: String,
    /// The predecessor path of a rename or copy.
    pub(crate) source: Option<String>,
}

/// A Git checkout compared with `origin/main`.
pub(crate) struct GitWorkspace {
    root: PathBuf,
    base: OnceLock<String>,
}

impl GitWorkspace {
    /// Open the checkout that contains `start`.
    pub(crate) fn open(start: &Path) -> Result<Self> {
        let output = git(start, &["rev-parse", "--show-toplevel"])?;
        let root = String::from_utf8_lossy(&output).trim().to_owned();
        Ok(Self {
            root: PathBuf::from(root),
            base: OnceLock::new(),
        })
    }

    /// The checkout root.
    pub(crate) fn root(&self) -> &Path {
        &self.root
    }

    /// The comparison commit: the merge base of `HEAD` and `origin/main`, or
    /// `origin/main` itself while a merge of it is in progress.
    pub(crate) fn require_base(&self) -> Result<&str> {
        if let Some(base) = self.base.get() {
            return Ok(base);
        }
        self.text(&["rev-parse", "--verify", "HEAD^{commit}"])?;
        let target = self.text(&["rev-parse", "--verify", &format!("{TARGET}^{{commit}}")])?;
        let merge_path = self.text(&["rev-parse", "--git-path", "MERGE_HEAD"])?;
        let merge_head = if self.root.join(&merge_path).exists() {
            Some(self.text(&["rev-parse", "--verify", "MERGE_HEAD^{commit}"])?)
        } else {
            None
        };
        if let Some(merge_head) = &merge_head
            && *merge_head != target
            && self.is_ancestor(merge_head, &target)?
        {
            return Err(Error::TargetMoved);
        }
        let base = match merge_head {
            Some(merge_head) if merge_head == target => merge_head,
            _ => self.text(&["merge-base", "HEAD", TARGET])?,
        };
        if base.is_empty() {
            return Err(Error::MissingBase);
        }
        self.text(&["rev-parse", "--verify", &format!("{base}^{{commit}}")])?;
        Ok(self.base.get_or_init(|| base))
    }

    /// The paths changed since the comparison commit below `roots`, with
    /// Git-detected renames, followed by untracked paths that Git does not
    /// ignore.
    pub(crate) fn changed_files(&self, roots: &[&str]) -> Result<Vec<Change>> {
        let base = self.require_base()?.to_owned();
        let mut args = vec!["diff", "--name-status", "-z", "--find-renames", &base, "--"];
        args.extend_from_slice(roots);
        let mut changes = parse_name_status(&self.bytes(&args)?);
        let mut untracked = vec!["ls-files", "--others", "--exclude-standard", "-z", "--"];
        untracked.extend_from_slice(roots);
        for path in self.paths(&untracked)? {
            if !changes.iter().any(|change| change.path == path) {
                changes.push(Change {
                    status: "A?".to_owned(),
                    path,
                    source: None,
                });
            }
        }
        Ok(changes)
    }

    /// Every tracked path and every untracked path that Git does not ignore.
    pub(crate) fn current_files(&self) -> Result<Vec<String>> {
        self.paths(&[
            "ls-files",
            "--cached",
            "--others",
            "--exclude-standard",
            "-z",
        ])
    }

    /// The files of the comparison commit below `root`.
    pub(crate) fn base_files(&self, root: &str) -> Result<Vec<String>> {
        let base = self.require_base()?.to_owned();
        self.paths(&["ls-tree", "-r", "--name-only", "-z", &base, "--", root])
    }

    /// The bytes of a file at the comparison commit.
    pub(crate) fn read_base(&self, path: &str) -> Result<Vec<u8>> {
        let base = self.require_base()?.to_owned();
        self.bytes(&["show", &format!("{base}:{path}")])
    }

    /// Whether a file exists at the comparison commit.
    pub(crate) fn base_file_exists(&self, path: &str) -> Result<bool> {
        let base = self.require_base()?.to_owned();
        let object = format!("{base}:{path}");
        Ok(run(&self.root, &["cat-file", "-e", &object])?
            .status
            .success())
    }

    fn is_ancestor(&self, ancestor: &str, descendant: &str) -> Result<bool> {
        let args = ["merge-base", "--is-ancestor", ancestor, descendant];
        let output = run(&self.root, &args)?;
        match output.status.code() {
            Some(0) => Ok(true),
            Some(1) => Ok(false),
            _ => Err(failure(&args, &output)),
        }
    }

    fn bytes(&self, args: &[&str]) -> Result<Vec<u8>> {
        git(&self.root, args)
    }

    fn text(&self, args: &[&str]) -> Result<String> {
        Ok(String::from_utf8_lossy(&self.bytes(args)?)
            .trim()
            .to_owned())
    }

    /// NUL-separated paths, sorted.
    fn paths(&self, args: &[&str]) -> Result<Vec<String>> {
        let output = self.bytes(args)?;
        let mut paths: Vec<String> = output
            .split(|byte| *byte == 0)
            .filter(|path| !path.is_empty())
            .map(|path| String::from_utf8_lossy(path).into_owned())
            .collect();
        paths.sort();
        Ok(paths)
    }
}

/// Parse `git diff --name-status -z` output.
fn parse_name_status(output: &[u8]) -> Vec<Change> {
    let mut fields = output
        .split(|byte| *byte == 0)
        .map(|field| String::from_utf8_lossy(field).into_owned());
    let mut changes = Vec::new();
    while let Some(status) = fields.next().filter(|status| !status.is_empty()) {
        let paired = status.starts_with('R') || status.starts_with('C');
        let source = if paired { fields.next() } else { None };
        let Some(path) = fields.next() else {
            break;
        };
        changes.push(Change {
            status,
            path,
            source,
        });
    }
    changes
}

/// Run Git in `cwd` and require a successful exit.
fn git(cwd: &Path, args: &[&str]) -> Result<Vec<u8>> {
    let output = run(cwd, args)?;
    if output.status.success() {
        Ok(output.stdout)
    } else {
        Err(failure(args, &output))
    }
}

/// Run Git without the caller's repository and secret variables.
fn run(cwd: &Path, args: &[&str]) -> Result<Output> {
    let mut command = Command::new("git");
    command.args(args).current_dir(cwd);
    for name in GIT_REPOSITORY_VARIABLES.iter().chain(SECRET_VARIABLES) {
        command.env_remove(name);
    }
    match command.output() {
        Ok(output) => Ok(output),
        Err(source) => Err(Error::GitStart {
            command: display(args),
            source,
        }),
    }
}

fn failure(args: &[&str], output: &Output) -> Error {
    Error::GitCommand {
        command: display(args),
        stderr: String::from_utf8_lossy(&output.stderr).trim().to_owned(),
    }
}

fn display(args: &[&str]) -> String {
    format!("git {}", args.join(" "))
}

#[cfg(test)]
#[path = "_tests_/git_tests.rs"]
mod git_tests;
