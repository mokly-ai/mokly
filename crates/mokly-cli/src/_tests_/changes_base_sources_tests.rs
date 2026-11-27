//! A historical configuration retains the working overrides through source discovery.

use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::config_validation::parse;
use mokly_catalogue::discovery::SourceKind;
use mokly_cli::cancellation::ServeCancellation;
use mokly_compare::base_render::HistoricalSources;
use mokly_compare::base_sources::BaseSourcesRequest;
use mokly_git::identity::ObjectId;
use mokly_render::runtime::Runtime;
use mokly_source_interface::tree::{Child, FileKind, Node, SourceTreeMock};
use serde_json::{json, to_value};
use unimock::{MockFn, Unimock, matching};

use crate::base_dependency_selection::resolution;
use crate::base_render_admission::ImmediateBaseRenders;
use crate::changes_base::NativeBase;

#[test]
fn source_package_order_uses_base_then_working_without_sidecar_sources() {
    let path = "/repo/mokly.config.json";
    let working_config = ResolvedConfig {
        input: parse(
            r#"{"moduleResolution":{
                "aliases":{"other":"working"},
                "sourcePackages":{"ui":{"esm":"working"},"theme":{"esm":"working"}}
            }}"#,
            path,
        )
        .unwrap(),
        file: path.into(),
        repo_root: "/repo".into(),
        modules: Default::default(),
        authored_inputs: Vec::new(),
        roots: Vec::new(),
    };
    let sources = HistoricalSources {
        tree: Arc::new(base_tree()),
        sources: Arc::new(Unimock::new(())),
        failures: Arc::new(Unimock::new(())),
    };
    let base = NativeBase {
        validation: None,
        admission: Arc::new(ImmediateBaseRenders),
        cancellation: Arc::new(ServeCancellation::default()),
        freshness: None,
        runtime: Arc::new(Runtime::new(
            Arc::new(Unimock::new(())),
            Arc::new(Unimock::new(())),
            Arc::new(Unimock::new(())),
            Arc::new(Unimock::new(())),
            Arc::new(Unimock::new(())),
            Arc::new(Unimock::new(())),
            "test".into(),
            None,
        )),
        dependencies: Arc::new(Unimock::new(())),
    };
    let sources = base
        .source_generation(
            &BaseSourcesRequest {
                working_config: &working_config,
                repository: Arc::new(Unimock::new(())),
                commit: ObjectId::parse(&"a".repeat(40)).unwrap(),
                sources: &sources,
                install_scripts: false,
                steps: Arc::new(Unimock::new(())),
            },
            None,
            None,
        )
        .unwrap();
    assert!(sources.dependencies.is_none());
    let inventory = sources
        .inventory
        .expect("a root with dir is discovered in the source phase");
    assert_eq!(inventory.files.len(), 1);
    assert_eq!(inventory.files[0].kind, SourceKind::Page);
    let settings = to_value(resolution(&sources.config)).unwrap();
    assert_eq!(
        settings["sourcePackages"],
        json!([{"ui":false,"theme":{"esm":"base"}},{"theme":{"esm":"working"}}])
    );
    assert_eq!(settings["aliases"], json!({"other":"base"}));
}

fn base_tree() -> Unimock {
    Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, path| {
                let kind = if path == Path::new("/repo") || path == Path::new("/repo/specs") {
                    FileKind::Directory
                } else if path == Path::new("/repo/mokly.config.json")
                    || path == Path::new("/repo/specs/card.page.html")
                {
                    FileKind::File
                } else {
                    return Ok(None);
                };
                Ok(Some(Node {
                    identity: path.into(),
                    kind,
                    lexical_kind: kind,
                }))
            }),
        SourceTreeMock::read
            .some_call(matching!((path) if *path == Path::new("/repo/mokly.config.json")))
            .returns(Ok(br#"{"moduleResolution":{
                "aliases":{"other":"base"},
                "sourcePackages":{"ui":false,"theme":{"esm":"base"}}
            }}"#
            .to_vec())),
        SourceTreeMock::children
            .some_call(matching!((path) if *path == Path::new("/repo/specs")))
            .returns(Ok(vec![Child {
                name: "card.page.html".into(),
                kind: FileKind::File,
            }])),
    ))
}
