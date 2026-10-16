//! The real CLI writes deterministic, complete static output without Node or Git.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use mokly_model::detail_context;
use mokly_model::output::ownership::Ownership;
use mokly_model::output::validation::digest;
use mokly_model::readers;
use mokly_model::usage::CatalogueUsage;
use tempfile::TempDir;

fn copy(source: &Path, destination: &Path) {
    fs::create_dir_all(destination).unwrap();
    for entry in fs::read_dir(source).unwrap() {
        let entry = entry.unwrap();
        if entry.file_type().unwrap().is_dir() {
            copy(&entry.path(), &destination.join(entry.file_name()));
        } else {
            fs::copy(entry.path(), destination.join(entry.file_name())).unwrap();
        }
    }
}
fn inventory(root: &Path) -> BTreeMap<PathBuf, Vec<u8>> {
    fn visit(root: &Path, path: &Path, files: &mut BTreeMap<PathBuf, Vec<u8>>) {
        for entry in fs::read_dir(path).unwrap() {
            let path = entry.unwrap().path();
            if path.is_dir() {
                visit(root, &path, files);
            } else {
                files.insert(
                    path.strip_prefix(root).unwrap().into(),
                    fs::read(path).unwrap(),
                );
            }
        }
    }
    let mut files = BTreeMap::new();
    visit(root, root, &mut files);
    files
}
fn build(root: &Path, output: &str) {
    let result = Command::new(env!("CARGO_BIN_EXE_mokly"))
        .args(["build", "--no-changes", "--strict", "--out", output])
        .env("PATH", "")
        .env("MOKLY_OUTPUT", "plain")
        .env_remove("MOKLY_NODE_EXECUTABLE")
        .current_dir(root)
        .output()
        .unwrap();
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
    assert!(result.stderr.is_empty());
    assert!(
        String::from_utf8_lossy(&result.stdout).starts_with(&format!("Built Mokly to {output} ("))
    );
}

#[test]
fn builds_twice_with_identical_bytes_and_complete_public_fences() {
    let root = TempDir::new().unwrap();
    copy(
        &Path::new(env!("CARGO_MANIFEST_DIR")).join("../mokly-graph/tests/fixtures/catalogue"),
        root.path(),
    );
    build(root.path(), ".context/first");
    let other = TempDir::new().unwrap();
    copy(
        &Path::new(env!("CARGO_MANIFEST_DIR")).join("../mokly-graph/tests/fixtures/catalogue"),
        other.path(),
    );
    build(other.path(), ".context/second");
    let files = inventory(&root.path().join(".context/first"));
    assert_eq!(files, inventory(&other.path().join(".context/second")));
    let marker = Ownership::parse(&files[Path::new(".mokly-export-artifact")]).unwrap();
    assert_eq!(files.len(), marker.files.len() + 1);
    for entry in marker.files {
        assert_eq!(digest(&files[Path::new(&entry.path)]), entry.sha256);
        assert_eq!(files[Path::new(&entry.path)].len() as u64, entry.size);
    }
    let index =
        readers::index(std::str::from_utf8(&files[Path::new("mokly-viewer/index.json")]).unwrap())
            .unwrap();
    assert_eq!(index.revision, 0);
    assert!(index.live.is_none());
    assert!(index.base.is_none());
    assert!(index.comparison_url.is_none());
    assert_eq!(files[Path::new("index.html")], files[Path::new("404.html")]);
    assert_eq!(
        files[Path::new("index.html")],
        files[Path::new("view/home/index.html")]
    );
    assert!(
        !files
            .keys()
            .any(|path| path.ends_with("live.json") || path.ends_with("events"))
    );
    let mut views = 0;
    for (path, bytes) in &files {
        if path.starts_with("mokly-viewer/entries") {
            let detail = detail_context::read(std::str::from_utf8(bytes).unwrap(), &index).unwrap();
            for view in detail.views {
                assert!(matches!(view.usage, CatalogueUsage::Ready { .. }));
                views += 1;
            }
        }
        if path.starts_with("static/mokly-generated")
            && path
                .extension()
                .is_some_and(|extension| extension == "html")
        {
            let html = std::str::from_utf8(bytes).unwrap();
            let metadata = html.find("data-mokly-inspector").unwrap();
            assert!(metadata < html.find("</head>").unwrap());
            assert!(html.contains("/mokly-viewer/client/inspector.js"));
        }
    }
    assert!(views > 0);
    assert!(files.contains_key(Path::new("static/specs/assets/public.svg")));
    assert!(!files.contains_key(Path::new("static/specs/home.screen.html")));
    assert!(!files.contains_key(Path::new("static/css/card.module.css")));
}

#[test]
fn output_is_config_relative_and_unowned_destination_is_preserved() {
    let root = TempDir::new().unwrap();
    fs::create_dir_all(root.path().join("tools/specs")).unwrap();
    fs::write(
        root.path().join("tools/mokly.config.json"),
        r#"{"repoRoot":"..","roots":[{"dir":"specs"}]}"#,
    )
    .unwrap();
    fs::write(
        root.path().join("tools/specs/home.screen.html"),
        "---\ntitle: Home\n---\n<p>Home</p>",
    )
    .unwrap();
    let run = |out: &str| {
        Command::new(env!("CARGO_BIN_EXE_mokly"))
            .args([
                "build",
                "--no-changes",
                "--config",
                "tools/mokly.config.json",
                "--out",
                out,
            ])
            .env("MOKLY_OUTPUT", "plain")
            .current_dir(root.path())
            .output()
            .unwrap()
    };
    let output = run("site");
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(root.path().join("tools/site/index.html").is_file());
    fs::write(root.path().join("tools/site/unowned"), b"keep").unwrap();
    let before = inventory(&root.path().join("tools/site"));
    let output = run("site");
    assert_eq!(output.status.code(), Some(1));
    assert!(String::from_utf8_lossy(&output.stderr).contains("[mokly/export-invalid]"));
    assert_eq!(before, inventory(&root.path().join("tools/site")));
}
