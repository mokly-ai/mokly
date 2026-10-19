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

use super::records;

/// Workspace containing the built packages and authored example.
pub(super) fn workspace() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

/// Isolate actual sources and make the optional defect injection local to one run.
pub(super) fn copy() -> TempDir {
    let directory = TempDir::new().unwrap();
    let workspace = workspace();
    let files = Command::new("git")
        .args([
            "ls-files",
            "-z",
            "--",
            "examples",
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
    fs::write(
        directory
            .path()
            .join("examples/basic/specs/behaviour-records.mockup.ts"),
        records::SOURCE,
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
            "render: props => TagChipView({...props, destination: DESTINATIONS.forms}),",
        ),
        "stack" => (
            "parts/compare_stack.tsx",
            "className=\"mbk-stack-layer mbk-stack-layer--after\"",
            "className=\"mbk-stack-layer\"",
        ),
        "caption" => (
            "components/parts/preview.tsx",
            "change = \"Appearance changed\"",
            "change = \"Wrong recorded change\"",
        ),
        "checklist" => (
            "components/parts/component_page.tsx",
            "return \"checklist\";",
            "return \"component\";",
        ),
        _ => panic!("unknown design mutation {mutation}"),
    };
    let path = root.join("examples/basic/specs/design").join(file);
    let original = fs::read_to_string(&path).unwrap();
    assert_eq!(original.matches(before).count(), 1, "{mutation}");
    fs::write(path, original.replace(before, after)).unwrap();
}
