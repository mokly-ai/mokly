//! The committed Changes fixture and a checked static build.

use std::fs;
use std::path::{Path, PathBuf};

use serde_json::Value;
use tempfile::TempDir;

use crate::files::write;
use crate::git::{commit_all, git};
use crate::process::{Finished, Mokly};
use crate::publication;
use crate::readers;

/// A screen document titled `Home`, with `extra` front matter lines.
pub fn screen(body: &str, extra: &str) -> String {
    format!("---\ntitle: Home\n{extra}---\n{body}")
}

/// A committed catalogue whose head changes, removes, and keeps entries.
pub struct Fixture {
    /// The repository root.
    pub root: TempDir,
    /// The commit of the branch `fixture-base`.
    pub base: String,
}

/// Create the Changes fixture on top of the publication fixture.
///
/// The base commit has a home screen with an image, a retired screen, an old
/// page, and an old note. The head changes the home screen and the image, and
/// removes the other three entries.
pub fn fixture() -> Fixture {
    let root = publication::fixture(false, "sha1");
    let path = root.path();
    write(
        path,
        "mokly.config.json",
        r#"{"review":{"base":"fixture-base"}}"#,
    );
    let image = r#"<img src="../../logo.svg">"#;
    write(
        path,
        "specs/home.screen.html",
        screen(&format!("<h1>Before</h1>{image}"), ""),
    );
    write(
        path,
        "logo.svg",
        r#"<svg xmlns="http://www.w3.org/2000/svg"><title>Before asset</title></svg>"#,
    );
    write(
        path,
        "specs/retired.screen.html",
        screen("<h1>Retired screen</h1>", ""),
    );
    write(
        path,
        "specs/old.page.html",
        format!(
            "---\ntitle: Old page\n---\n<!doctype html><html><head></head><body>Old page{image}</body></html>"
        ),
    );
    write(
        path,
        "specs/old-note.md",
        "# Old note\n\nHistorical document\n",
    );
    commit_all(path, "base catalogue");
    git(path, &["branch", "fixture-base"]);
    let base = git(path, &["rev-parse", "HEAD"]);
    write(
        path,
        "specs/home.screen.html",
        screen(&format!("<h1>After</h1>{image}"), ""),
    );
    write(
        path,
        "logo.svg",
        r#"<svg xmlns="http://www.w3.org/2000/svg"><title>After asset</title></svg>"#,
    );
    for name in ["retired.screen.html", "old.page.html", "old-note.md"] {
        fs::remove_file(path.join("specs").join(name)).unwrap();
    }
    commit_all(path, "changed catalogue");
    Fixture { root, base }
}

/// A successful static build into `.context/site`.
pub struct Build {
    /// The finished command.
    pub finished: Finished,
    /// The output folder.
    pub output: PathBuf,
    /// The catalogue index, checked by the model reader.
    pub index: Value,
}

/// Build `root` into `.context/site` with `extra` arguments, and check the index.
pub fn build(mokly: &Mokly, root: &Path, extra: &[&str], mode: &str) -> Build {
    let mut args = vec!["build", "--out=.context/site"];
    args.extend_from_slice(extra);
    let finished = mokly.command(root, &args, mode).run();
    assert_eq!(finished.code, Some(0), "{}", finished.stderr);
    let output = root.join(".context/site");
    let index = readers::index(&fs::read(output.join("mokly-viewer/index.json")).unwrap());
    Build {
        finished,
        output,
        index,
    }
}
