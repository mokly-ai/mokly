//! Prepared HTML and JavaScript definitions over a unimock source tree.

use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::Arc;

use html5ever::tendril::TendrilSink;
use html5ever::tree_builder::TreeBuilderOpts;
use html5ever::{ParseOpts, parse_document};
use mokly_catalogue::config_types::{Config, ResolvedConfig, ResolvedRoot, RootConfig};
use mokly_catalogue::definition_provider::{
    DefinitionProvider, DefinitionProviderMock, Definitions, ProvidedDefinition,
};
use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::input::EntryInput;
use mokly_catalogue::preparation::{Builder, CatalogueBuilder, PreparedCatalogue};
use mokly_catalogue::template_types::{SavedSlot, Template};
use mokly_model::axes::EntryKind;
use mokly_model::catalogue::SourceLocation;
use mokly_source_interface::tree::SourceTreeMock;
use mokly_source_interface::tree::{Child, FileKind, Node};
use serde_json::json;
use unimock::{MockFn, Unimock, matching};

use crate::html_arena::Arena;
use crate::tree::{self, Node as HtmlNode};
use crate::{parse, serialize};

fn terminal_text(nodes: &[HtmlNode]) -> bool {
    tree::walk(nodes).any(|node| {
        matches!(node, HtmlNode::Element(element) if element.is_html() && element.name == "plaintext")
    })
}

/// Parse a test source as an authored template body, with source positions at `path`.
pub(crate) fn authored(source: &str, path: &str, page: bool) -> Vec<HtmlNode> {
    let template = Template {
        source_path: path.into(),
        source: source.into(),
        body: source.into(),
        body_offset: 0,
        page,
    };
    parse::html(template.located_html())
}

/// A saved variant slot fragment with a placeholder front matter position.
pub(crate) fn saved_slot(body: &str) -> SavedSlot {
    SavedSlot {
        body: body.into(),
        source: SourceLocation {
            path: "specs/panel.component.html".into(),
            line: 1,
            column: 1,
            export: None,
        },
    }
}

pub(crate) fn legacy_authored_document(source: &str) -> Vec<HtmlNode> {
    legacy_document_with_mode(source, true)
}

fn legacy_document_with_mode(source: &str, authored: bool) -> Vec<HtmlNode> {
    let nodes = parse_document(
        Arena::new(authored),
        ParseOpts {
            tree_builder: TreeBuilderOpts {
                scripting_enabled: false,
                ..Default::default()
            },
            ..Default::default()
        },
    )
    .one(source);
    if terminal_text(&nodes) {
        parse_document(
            Arena::new(authored),
            ParseOpts {
                tree_builder: TreeBuilderOpts {
                    scripting_enabled: false,
                    ..Default::default()
                },
                ..Default::default()
            },
        )
        .one(serialize::html(&nodes))
    } else {
        nodes
    }
}

pub(super) fn prepared(body: &str) -> PreparedCatalogue {
    let files = BTreeMap::from([
        (
            PathBuf::from("/repo/specs/home.screen.html"),
            format!("---\ntitle: Home\nprops: {{label: Supplier}}\n---\n{body}"),
        ),
        (
            PathBuf::from("/repo/specs/shared.mockup.tsx"),
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
    let definitions = Arc::new(Unimock::new(
        DefinitionProviderMock::describe
            .next_call(matching!(_, _))
            .returns(Ok(Definitions {
                entries: vec![definition],
                ..Default::default()
            })),
    ));
    prepare(files, definitions)
}

pub(super) fn prepared_html(body: &str, component: &str) -> PreparedCatalogue {
    prepare(
        BTreeMap::from([
            (
                PathBuf::from("/repo/specs/home.screen.html"),
                format!("---\ntitle: Home\n---\n{body}"),
            ),
            (
                PathBuf::from("/repo/specs/note.component.html"),
                format!(
                    "---\ntitle: Note\nelement: ui-note\npropSchema: {{type: object, additionalProperties: false, properties: {{}}}}\n---\n{component}"
                ),
            ),
        ]),
        Arc::new(Unimock::new(())),
    )
}

fn prepare(
    files: BTreeMap<PathBuf, String>,
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
                let kind = if projection.contains_key(path) {
                    Some(FileKind::File)
                } else if projection.keys().any(|file| file.starts_with(path)) {
                    Some(FileKind::Directory)
                } else {
                    None
                };
                Ok(kind.map(|kind| Node {
                    identity: path.into(),
                    lexical_kind: kind,
                    kind,
                }))
            })),
        SourceTreeMock::children
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                let mut found = BTreeMap::new();
                for file in children.keys() {
                    if let Ok(relative) = file.strip_prefix(path) {
                        let mut parts = relative.components();
                        if let Some(name) = parts.next() {
                            let kind = if parts.next().is_some() {
                                FileKind::Directory
                            } else {
                                FileKind::File
                            };
                            found.insert(name.as_os_str().to_str().unwrap().to_owned(), kind);
                        }
                    }
                }
                Ok(found
                    .into_iter()
                    .map(|(name, kind)| Child { name, kind })
                    .collect())
            })),
        SourceTreeMock::read
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| Ok(reads[path].as_bytes().to_vec()))),
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
