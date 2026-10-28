use std::collections::BTreeSet;

use mokly_catalogue::discovery::{SourceFile, SourceKind};
use mokly_sidecar::definitions::Definitions;
use serde_json::json;

use super::unattributed;

fn file(path: &str, kind: SourceKind) -> SourceFile {
    SourceFile {
        path: path.into(),
        absolute: path.into(),
        identity: path.into(),
        root_index: 0,
        kind,
        excluded: false,
    }
}

#[test]
fn only_definitions_without_a_source_path_outside_stories_files_are_unattributed() {
    let described: Definitions = serde_json::from_value(json!({
        "screens": [
            { "handle": "specs/kit.mockup.tsx#installed" },
            { "handle": "specs/board.mockup.tsx#board", "sourcePath": "specs/board.mockup.tsx" },
        ],
        "pages": [],
        "useCases": [],
        "folders": [{ "handle": "specs/kit.mockup.tsx#folder" }],
        "components": [{ "handle": "specs/label.stories.tsx#default" }],
        "stories": [],
        "warnings": [],
    }))
    .unwrap();
    let files = [
        file("specs/label.stories.tsx", SourceKind::Stories),
        file("specs/kit.mockup.tsx", SourceKind::Module),
    ];
    assert_eq!(
        unattributed(&described, &files),
        BTreeSet::from([
            "specs/kit.mockup.tsx#folder".to_owned(),
            "specs/kit.mockup.tsx#installed".to_owned(),
        ])
    );
}
