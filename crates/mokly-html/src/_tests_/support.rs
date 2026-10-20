//! Prepared HTML and JavaScript definitions over a unimock source tree.

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config_types::{Config, ResolvedConfig, ResolvedRoot, RootConfig};
use mokly_catalogue::definition_provider::{
    DefinitionProvider, DefinitionProviderMock, Definitions, ProvidedDefinition,
};
use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::input::EntryInput;
use mokly_catalogue::preparation::{Builder, CatalogueBuilder, PreparedCatalogue};
use mokly_model::axes::EntryKind;
use mokly_model::catalogue::SourceLocation;
use mokly_source_interface::tree::SourceTreeMock;
use mokly_source_interface::tree::{Child, FileKind, Node};
use serde_json::json;
use unimock::{MockFn, Unimock, matching};

pub(super) fn prepared(body: &str) -> PreparedCatalogue {
    let files = BTreeMap::from([
        (
            "/repo/specs/home.screen.html".to_owned(),
            format!("---\ntitle: Home\nprops: {{label: Supplier}}\n---\n{body}"),
        ),
        (
            "/repo/specs/shared.mockup.tsx".to_owned(),
            "export default component;".into(),
        ),
    ]);
    let definition = ProvidedDefinition {
        rendering: Default::default(),
        exporting_file: "specs/shared.mockup.tsx".into(),
        source: SourceLocation {
            path: "specs/shared.mockup.tsx".into(),
            export: Some("default".into()),
            line: 1,
            column: 1,
        },
        kind: EntryKind::Component,
        input: EntryInput {
            title: "JavaScript".into(),
            path: Some("components/js".into()),
            element: Some("ui-js".into()),
            prop_schema: Some(
                json!({"type":"object","additionalProperties":false,"properties":{"label":{"type":"string"}},"required":["label"]}),
            ),
            props: serde_json::from_value(json!({"label":"Saved"})).unwrap(),
            slots: vec!["children".into()],
            ..Default::default()
        },
    };
    prepare(
        files,
        Arc::new(Unimock::new(
            DefinitionProviderMock::describe
                .next_call(matching!(_, _))
                .returns(Ok(Definitions {
                    entries: vec![definition],
                    ..Default::default()
                })),
        )),
    )
}

pub(super) fn prepared_html(body: &str, component: &str) -> PreparedCatalogue {
    prepare(
        BTreeMap::from([
            (
                "/repo/specs/home.screen.html".into(),
                format!("---\ntitle: Home\n---\n{body}"),
            ),
            (
                "/repo/specs/note.component.html".into(),
                format!(
                    "---\ntitle: Note\nelement: ui-note\npropSchema: {{type: object, additionalProperties: false, properties: {{}}}}\n---\n{component}"
                ),
            ),
        ]),
        Arc::new(Unimock::new(())),
    )
}

fn prepare(
    files: BTreeMap<String, String>,
    definitions: Arc<dyn DefinitionProvider>,
) -> PreparedCatalogue {
    let files = Arc::new(files);
    let projection = files.clone();
    let children = files.clone();
    let reads = files;
    let mock = Arc::new(Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                let path = path.to_string_lossy();
                let kind = if projection.contains_key(path.as_ref()) {
                    Some(FileKind::File)
                } else if projection
                    .keys()
                    .any(|file| file.starts_with(&format!("{path}/")))
                {
                    Some(FileKind::Directory)
                } else {
                    None
                };
                Ok(kind.map(|kind| Node {
                    identity: Path::new(path.as_ref()).into(),
                    lexical_kind: kind,
                    kind,
                }))
            })),
        SourceTreeMock::children
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                let prefix = format!("{}/", path.to_string_lossy().trim_end_matches('/'));
                let mut found = BTreeMap::new();
                for file in children.keys() {
                    if let Some(relative) = file.strip_prefix(&prefix) {
                        let (name, kind) = relative
                            .split_once('/')
                            .map_or((relative, FileKind::File), |(name, _)| {
                                (name, FileKind::Directory)
                            });
                        found.insert(name.to_owned(), kind);
                    }
                }
                Ok(found
                    .into_iter()
                    .map(|(name, kind)| Child { name, kind })
                    .collect())
            })),
        SourceTreeMock::read
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                Ok(reads[&path.to_string_lossy().to_string()]
                    .as_bytes()
                    .to_vec())
            })),
    )));
    let config = ResolvedConfig {
        input: Config::default(),
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        authored_inputs: Vec::new(),
        roots: vec![ResolvedRoot {
            input: RootConfig {
                dir: "specs".into(),
                files: None,
                path: None,
                transparent: None,
            },
            directory: "/repo/specs".into(),
            identity: "/repo/specs".into(),
        }],
    };
    Builder {
        tree: mock.clone(),
        discovery: Arc::new(Discoverer { tree: mock.clone() }),
        definitions,
    }
    .prepare(&config, None)
    .unwrap()
}
