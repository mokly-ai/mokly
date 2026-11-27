//! Run the same workspace layout cases as the JavaScript resolver.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_source_interface::tree::{FileKind, Node, SourceTreeMock};
use serde::Deserialize;
use unimock::{MockFn, Unimock, matching};

use crate::resolution::{Resolution, SourcePackages};
use crate::workspace_sources::source;

#[derive(Deserialize)]
struct Fixture {
    files: BTreeMap<PathBuf, String>,
    cases: Vec<Case>,
}

#[derive(Deserialize)]
struct Case {
    name: String,
    target: PathBuf,
    expected: Option<PathBuf>,
    #[serde(default)]
    extensions: Vec<String>,
    #[serde(
        default,
        rename = "sourcePackages",
        deserialize_with = "source_packages"
    )]
    source_packages: Vec<SourcePackages>,
}

#[derive(Deserialize)]
#[serde(untagged)]
enum Entry {
    Folders(BTreeMap<String, String>),
    Disabled(bool),
}

fn source_packages<'de, D: serde::Deserializer<'de>>(
    deserializer: D,
) -> Result<Vec<SourcePackages>, D::Error> {
    Vec::<BTreeMap<String, Entry>>::deserialize(deserializer)?
        .into_iter()
        .map(|entries| {
            entries
                .into_iter()
                .map(|(name, entry)| match entry {
                    Entry::Folders(folders) => Ok((name, Some(folders))),
                    Entry::Disabled(false) => Ok((name, None)),
                    Entry::Disabled(true) => Err(serde::de::Error::custom("expected false")),
                })
                .collect()
        })
        .collect()
}

#[test]
fn workspace_package_targets_follow_the_shared_source_lookup_cases() {
    let root = Path::new("/repo");
    let fixture: Fixture = serde_json::from_str(include_str!(
        "../../../../tests/fixtures/workspace-sources.json"
    ))
    .unwrap();
    let files = Arc::new(fixture.files);
    let projection = files.clone();
    let tree = Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                let relative = path.strip_prefix(root).unwrap();
                Ok(projection.contains_key(relative).then(|| Node {
                    identity: path.into(),
                    lexical_kind: FileKind::File,
                    kind: FileKind::File,
                }))
            })),
        SourceTreeMock::read
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                let relative = path.strip_prefix(root).unwrap();
                Ok(files[relative].as_bytes().to_vec())
            })),
    ));
    for case in fixture.cases {
        let settings = Resolution {
            extensions: case.extensions,
            source_packages: case.source_packages,
            ..Default::default()
        };
        assert_eq!(
            source(&tree, root, &root.join(case.target), &settings),
            case.expected.map(|path| root.join(path)),
            "{}",
            case.name
        );
    }
}
