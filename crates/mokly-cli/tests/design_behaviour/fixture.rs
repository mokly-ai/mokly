//! Copy the authored catalogue; optional mutations touch only the temporary copy.

use std::env;
use std::fs;
#[cfg(unix)]
use std::os::unix::fs::symlink;
#[cfg(windows)]
use std::os::windows::fs::symlink_dir;
use std::path::{Path, PathBuf};
use std::process::Command;

use tempfile::TempDir;

/// Workspace containing the built packages and authored example.
pub(super) fn workspace() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

/// Isolate actual sources, including the `@mokly/ui` sources that the design
/// library imports by repository path, and make the optional defect injection
/// local to one run.
pub(super) fn copy() -> TempDir {
    let directory = TempDir::new().unwrap();
    let workspace = workspace();
    let files = Command::new("git")
        .args([
            "ls-files",
            "-z",
            "--",
            ".gitignore",
            "examples",
            "packages/ui/src",
            "docs/protocol",
            "plans/rust-rebuild.md",
        ])
        .current_dir(&workspace)
        .output()
        .unwrap();
    assert!(files.status.success());
    for name in files
        .stdout
        .split(|byte| *byte == 0)
        .filter(|name| !name.is_empty())
    {
        let name = str::from_utf8(name).unwrap();
        let target = directory.path().join(name);
        fs::create_dir_all(target.parent().unwrap()).unwrap();
        fs::copy(workspace.join(name), target).unwrap();
    }
    fs::write(
        directory.path().join("package.json"),
        r#"{"private":true,"type":"module"}"#,
    )
    .unwrap();
    #[cfg(unix)]
    symlink(
        workspace.join("node_modules"),
        directory.path().join("node_modules"),
    )
    .unwrap();
    #[cfg(windows)]
    symlink_dir(
        workspace.join("node_modules"),
        directory.path().join("node_modules"),
    )
    .unwrap();
    if let Ok(mutation) = env::var("MOKLY_TEST_DESIGN_MUTATION") {
        mutate(directory.path(), &mutation);
    }
    directory
}

fn mutate(root: &Path, mutation: &str) {
    let (file, before, after) = match mutation {
        "own-props" => (
            "library/controls/tag-chip.tsx",
            "render: TagChipView,",
            "render: props => TagChipView({...props, destination: CANVAS_PAGES.tagForms}),",
        ),
        "stack" => (
            "library/canvas/frame_compare.tsx",
            "<ComparisonLayer side=\"after\">",
            "<ComparisonLayer side=\"before\">",
        ),
        "stack-swap" => (
            "library/canvas/frame_compare.tsx",
            "<ComparisonSurface>{before}</ComparisonSurface>\n      </ComparisonLayer>\n      <ComparisonLayer side=\"after\">\n        <ComparisonSurface>{current}</ComparisonSurface>",
            "<ComparisonSurface>{current}</ComparisonSurface>\n      </ComparisonLayer>\n      <ComparisonLayer side=\"after\">\n        <ComparisonSurface>{before}</ComparisonSurface>",
        ),
        _ => panic!("unknown design mutation {mutation}"),
    };
    let path = root.join("examples/basic/specs/design").join(file);
    let original = fs::read_to_string(&path).unwrap();
    assert_eq!(original.matches(before).count(), 1, "{mutation}");
    fs::write(path, original.replace(before, after)).unwrap();
}
