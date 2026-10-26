//! Local links in `AGENTS.md`, `docs/`, `plans/`, and every `README.md`
//! resolve, and their anchors match the GitHub heading slugs.

use std::collections::HashMap;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::process::Command;

use percent_encoding::percent_decode_str;
use regex::Regex;

use crate::markdown::{anchors, links};
use crate::support::repository_root;

#[test]
fn a_markdown_parser_decides_which_text_is_a_link() {
    let none: [&str; 0] = [];
    assert_eq!(links("`[a](a.md)` ``[b](`b`)`` [c](c.md)"), ["c.md"]);
    assert_eq!(links("an unclosed ` [d](d.md)"), ["d.md"]);
    assert_eq!(links("`a span that\nwraps [e](e.md)` [f](f.md)"), ["f.md"]);
    assert_eq!(links("`a wrapped\nspan` [g](g.md) `h`"), ["g.md"]);
    assert_eq!(links("\\` [i](i.md) \\`"), ["i.md"]);
    assert_eq!(links("```\n[j](j.md)\n```"), none);
    assert_eq!(links("![k](k.png) [l](l.md \"Title\")"), ["k.png", "l.md"]);
    assert_eq!(links("[m][ref]\n\n[ref]: m.md"), ["m.md"]);
}

#[test]
fn local_documentation_and_plan_links_resolve_and_anchors_match_github_headings() {
    let root = normalize(&repository_root());
    let external = Regex::new(r"(?i)^(?:[a-z][a-z0-9+.-]*:|//)").unwrap();
    let mut contents = Contents::new(&root);
    let mut failures = Vec::new();
    let mut protocol_links = 0;
    let mut plan_links = 0;
    for source in checked_markdown(&root) {
        for destination in links(&contents.read(&source)) {
            if external.is_match(&destination) {
                continue;
            }
            let mut parts = destination.split('#');
            let relative = parts.next().unwrap_or_default();
            let hash = parts.next().filter(|hash| !hash.is_empty());
            if relative.is_empty() && hash.is_none() {
                continue;
            }
            let candidate = if relative.is_empty() {
                normalize(&root.join(&source))
            } else {
                let directory = source
                    .rsplit_once('/')
                    .map_or("", |(directory, _)| directory);
                normalize(&root.join(directory).join(decode(relative)))
            };
            let Ok(inside) = candidate.strip_prefix(&root) else {
                continue;
            };
            let mut target = posix(inside);
            if fs::metadata(&candidate).is_ok_and(|metadata| metadata.is_dir()) {
                if hash.is_none() {
                    continue;
                }
                target = if target.is_empty() {
                    "README.md".to_owned()
                } else {
                    format!("{target}/README.md")
                };
            }
            if target.starts_with("docs/protocol/") {
                protocol_links += 1;
            }
            if source.starts_with("plans/") {
                plan_links += 1;
            }
            if !fs::metadata(root.join(&target)).is_ok_and(|metadata| metadata.is_file()) {
                failures.push(format!("{source} -> {destination}: missing file"));
                continue;
            }
            if let Some(hash) = hash
                && target.ends_with(".md")
                && !anchors(&contents.read(&target)).contains(&decode(hash))
            {
                failures.push(format!("{source} -> {destination}: missing anchor"));
            }
        }
    }
    assert!(
        protocol_links > 100,
        "only {protocol_links} protocol links checked"
    );
    assert!(plan_links > 0, "only {plan_links} plan links checked");
    assert_eq!(failures, Vec::<String>::new());
}

/// Repository files read once each, by repository-relative path.
struct Contents {
    root: PathBuf,
    files: HashMap<String, String>,
}

impl Contents {
    fn new(root: &Path) -> Self {
        Self {
            root: root.to_path_buf(),
            files: HashMap::new(),
        }
    }

    fn read(&mut self, file: &str) -> String {
        let root = &self.root;
        self.files
            .entry(file.to_owned())
            .or_insert_with(|| {
                let bytes = fs::read(root.join(file))
                    .unwrap_or_else(|error| panic!("read {file}: {error}"));
                String::from_utf8_lossy(&bytes).into_owned()
            })
            .clone()
    }
}

/// The tracked and untracked, not ignored Markdown files that the check
/// covers: `AGENTS.md`, `docs/`, `plans/`, and every `README.md`.
fn checked_markdown(root: &Path) -> Vec<String> {
    let output = Command::new("git")
        .args([
            "ls-files",
            "--cached",
            "--others",
            "--exclude-standard",
            "-z",
        ])
        .current_dir(root)
        .output()
        .expect("git starts");
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    String::from_utf8(output.stdout)
        .expect("Git lists UTF-8 paths")
        .split('\0')
        .filter(|file| {
            file.ends_with(".md")
                && (*file == "AGENTS.md"
                    || file.starts_with("docs/")
                    || file.starts_with("plans/")
                    || file.rsplit('/').next() == Some("README.md"))
        })
        .map(str::to_owned)
        .collect()
}

/// A percent-decoded link path or fragment.
fn decode(text: &str) -> String {
    percent_decode_str(text)
        .decode_utf8()
        .expect("link paths decode to UTF-8")
        .into_owned()
}

/// A path with `.` and `..` resolved lexically, as `path.resolve` does.
fn normalize(path: &Path) -> PathBuf {
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                normalized.pop();
            }
            other => normalized.push(other),
        }
    }
    normalized
}

/// The `/`-separated spelling of a repository-relative path.
fn posix(path: &Path) -> String {
    path.components()
        .map(|component| component.as_os_str().to_str().expect("UTF-8 paths"))
        .collect::<Vec<_>>()
        .join("/")
}
