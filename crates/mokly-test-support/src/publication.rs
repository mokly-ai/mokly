//! The committed publication fixture, publish arguments, and private build cleanup.

use std::fs;
use std::path::{Path, PathBuf};

use tempfile::TempDir;

use crate::files::{link_directory, write};
use crate::git;
use crate::process::{Invocation, Mokly, PUBLISH_BUILD};
use crate::workspace;

/// The bearer token that the fake receiver expects by default.
pub const TOKEN: &str = "private/a==";

/// A JavaScript home page that appends to its own source while it renders.
const SELF_EDITING_PAGE: &str = "import fs from 'node:fs'; import {definePage} from '@mokly/mokly'; export default definePage({title:'Home',description:'',relatedDocs:[],render(){fs.appendFileSync('specs/home.mockup.ts','\\n// changed');return '<!doctype html><html><head><title>Home</title></head><body><h1>Home</h1></body></html>'}});";

/// Create a committed catalogue with one home page and an unrelated `signal.txt`.
///
/// With `javascript`, the page is a module that edits its own source while it
/// renders, and the workspace `node_modules` is linked. `object_format` is
/// `sha1` or `sha256`.
pub fn fixture(javascript: bool, object_format: &str) -> TempDir {
    let root = tempfile::Builder::new()
        .prefix("mokly-static-publish-")
        .tempdir_in(temporary_root())
        .unwrap();
    let path = root.path();
    fs::create_dir(path.join("specs")).unwrap();
    write(path, "mokly.config.json", "{}");
    write(
        path,
        ".gitignore",
        "node_modules/\n.context/\nmokly-static/\n",
    );
    write(path, "signal.txt", "original");
    if javascript {
        write(path, "specs/home.mockup.ts", SELF_EDITING_PAGE);
        link_node_modules(path);
    } else {
        write(
            path,
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<h1>Home</h1>",
        );
    }
    git::init(path, object_format);
    git::git(path, &["add", "."]);
    git::git(path, &["commit", "-qm", "fixture"]);
    root
}

/// The temporary folder without symbolic links, so that printed paths match it.
///
/// Windows keeps the plain temporary folder, because its canonical form adds a
/// verbatim prefix.
pub fn temporary_root() -> PathBuf {
    let root = std::env::temp_dir();
    if cfg!(unix) {
        root.canonicalize().unwrap()
    } else {
        root
    }
}

/// Link the workspace `node_modules` into `root` so that JavaScript entries resolve.
pub fn link_node_modules(root: &Path) {
    link_directory(
        &workspace::root().join("node_modules"),
        &root.join("node_modules"),
    );
}

/// The arguments of `mokly publish` for the receiver at `endpoint`.
///
/// With `environment_credentials`, the endpoint and the token stay out of the
/// arguments, so that the caller can supply them in the environment.
pub fn publish_args(endpoint: &str, environment_credentials: bool, extra: &[&str]) -> Vec<String> {
    let mut args = vec![
        "publish".to_owned(),
        "--no-changes".to_owned(),
        "--repository=example.com/team/site".to_owned(),
        "--sidecars=1".to_owned(),
    ];
    if !environment_credentials {
        args.push(format!("--endpoint={endpoint}"));
        args.push(format!("--token={TOKEN}"));
    }
    args.extend(extra.iter().map(|arg| (*arg).to_owned()));
    args
}

/// Prepare `mokly publish` in `root` for the receiver at `endpoint`.
pub fn publish(
    mokly: &Mokly,
    root: &Path,
    endpoint: &str,
    mode: &str,
    extra: &[&str],
) -> Invocation {
    let args = publish_args(endpoint, false, extra);
    let args: Vec<_> = args.iter().map(String::as_str).collect();
    mokly.command(root, &args, mode)
}

/// The private build directory that `mokly publish` reported in `stdout`.
///
/// Panics unless standard output reports exactly one directory.
pub fn directory(stdout: &str) -> PathBuf {
    let lines: Vec<_> = stdout
        .split('\n')
        .filter_map(|line| line.strip_prefix(PUBLISH_BUILD))
        .collect();
    assert_eq!(lines.len(), 1, "{stdout}");
    PathBuf::from(lines[0].trim_end_matches('\r'))
}

/// The private `mokly-publish-` root of a reported `site` build folder.
///
/// Panics unless `output` is a `site` folder directly in a `mokly-publish-` folder, so that a
/// test never removes a folder that the binary did not create.
pub fn private_root(output: &Path) -> PathBuf {
    assert_eq!(output.file_name().unwrap(), "site", "{}", output.display());
    let root = output.parent().unwrap();
    let name = root.file_name().unwrap().to_string_lossy();
    assert!(name.starts_with("mokly-publish-"), "{}", output.display());
    root.to_path_buf()
}

/// The private publish roots of a test, which the guard removes when it drops.
#[derive(Default)]
pub struct Outputs(Vec<PathBuf>);

impl Outputs {
    /// Check that `output` is a `site` folder in a private `mokly-publish-` root,
    /// and remove that root when the guard drops.
    pub fn push(&mut self, output: PathBuf) {
        self.0.push(private_root(&output));
    }
}

impl Drop for Outputs {
    fn drop(&mut self) {
        for root in &self.0 {
            let _ = fs::remove_dir_all(root);
        }
    }
}
