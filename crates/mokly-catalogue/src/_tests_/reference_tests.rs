//! Captured Markdown entry set with JavaScript targets supplied through describe.

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::Arc;

use mokly_model::axes::EntryKind;
use mokly_model::catalogue::SourceLocation;
use mokly_source_interface::tree::SourceTreeMock;
use serde_json::{Value, json};
use unimock::{MockFn, Unimock, matching};

use crate::config_types::{Config, ResolvedConfig, ResolvedRoot, RootConfig};
use crate::definition_provider::{DefinitionProviderMock, Definitions, ProvidedDefinition};
use crate::discovery::{DiscoveryMock, Inventory, SourceFile, SourceKind};
use crate::input::EntryInput;
use crate::preparation::{Builder, CatalogueBuilder};

#[test]
fn captured_markdown_entries_match_kind_path_title_and_tags() {
    let fixture: Value = serde_json::from_str(include_str!(
        "../../tests/fixtures/reference-documents.json"
    ))
    .unwrap();
    let sources: BTreeMap<String, String> =
        serde_json::from_value(fixture["files"].clone()).unwrap();
    let reads: BTreeMap<_, _> = sources
        .iter()
        .map(|(path, text)| (Path::new("/repo").join(path), text.as_bytes().to_vec()))
        .collect();
    let mut files: Vec<_> = sources
        .keys()
        .map(|path| SourceFile {
            path: path.clone(),
            absolute: Path::new("/repo").join(path),
            identity: path.clone(),
            root_index: 0,
            kind: SourceKind::Document,
            excluded: false,
        })
        .collect();
    let javascript = "examples/basic/specs/entries.mockup.ts";
    files.push(SourceFile {
        path: javascript.into(),
        absolute: Path::new("/repo").join(javascript),
        identity: javascript.into(),
        root_index: 0,
        kind: SourceKind::Module,
        excluded: false,
    });
    let inventory = Inventory {
        sources: files.iter().map(|file| file.path.clone()).collect(),
        files,
        folders: Vec::new(),
    };
    let definitions = [
        (EntryKind::Screen, "example/screens/welcome"),
        (EntryKind::Page, "example/getting-started"),
        (EntryKind::UseCase, "example/tour"),
    ]
    .into_iter()
    .map(|(kind, path)| ProvidedDefinition {
        rendering: Default::default(),
        exporting_file: javascript.into(),
        source: SourceLocation {
            path: javascript.into(),
            line: 1,
            column: 1,
            export: Some(path.into()),
        },
        kind,
        input: EntryInput {
            prop_schema: (kind == EntryKind::Component)
                .then(|| json!({"type":"object","additionalProperties":false,"properties":{}})),
            title: path.into(),
            path: Some(path.into()),
            ..EntryInput::default()
        },
    })
    .collect();
    let mock = Arc::new(Unimock::new((
        DiscoveryMock::discover
            .next_call(matching!(_, _))
            .returns(Ok(inventory)),
        DefinitionProviderMock::describe
            .next_call(matching!((_, files) if files.len()==1 && files[0].path=="examples/basic/specs/entries.mockup.ts"))
            .returns(Ok(Definitions {
                entries: definitions,
                ..Definitions::default()
            })),
        SourceTreeMock::read
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                Ok(reads[path].clone())
            })),
    )));
    let config = ResolvedConfig {
        authored_inputs: Vec::new(),
        input: Config::default(),
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        roots: vec![ResolvedRoot {
            input: RootConfig {
                dir: "examples/basic/specs".into(),
                files: None,
                path: None,
                transparent: None,
            },
            directory: "/repo/examples/basic/specs".into(),
            identity: "/repo/examples/basic/specs".into(),
        }],
    };
    let builder: &dyn CatalogueBuilder = &Builder {
        tree: mock.clone(),
        discovery: mock.clone(),
        definitions: mock,
    };
    let prepared = builder.prepare(&config, None).unwrap();
    assert!(prepared.deferred_modules.is_empty());
    let actual: Vec<_> = prepared.model.entries.iter().filter(|entry|entry.content.kind()==EntryKind::Document)
        .map(|entry|json!({"kind":"document","path":entry.metadata.path,"title":entry.metadata.title,"tags":entry.metadata.tags})).collect();
    assert_eq!(json!(actual), fixture["entries"]);
    insta::assert_snapshot!(
        "captured_markdown_inventory",
        serde_json::to_string_pretty(&actual).unwrap()
    );
}
