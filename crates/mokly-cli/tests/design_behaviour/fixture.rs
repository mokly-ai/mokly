//! Copy the authored catalogue; optional mutations touch only the temporary copy.

use std::env;
use std::fs;
use std::path::{Path, PathBuf};

use mokly_test_support::example;
use tempfile::TempDir;

use super::records;

/// Workspace containing the built packages and authored example.
pub(super) fn workspace() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

/// Isolate actual sources and make the optional defect injection local to one run.
pub(super) fn copy() -> TempDir {
    let directory = example::copy();
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
        "stack-swap" => (
            "components/parts/preview.tsx",
            "after={<ComparedVersion before={false} subject={subject} />}\n          before={<ComparedVersion before subject={subject} />}",
            "after={<ComparedVersion before subject={subject} />}\n          before={<ComparedVersion before={false} subject={subject} />}",
        ),
        "caption-record" => (
            "components/parts/comparison_fixtures.ts",
            "export const actionComparison = {\n  status: \"changed\",\n  reason: \"output\",",
            "export const actionComparison = {\n  status: \"changed\",\n  reason: \"styles\",",
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
