//! Catalogue and sidecar boundaries for authored control-character diagnostics.

use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config_types::{Config, ResolvedConfig, ResolvedRoot, RootConfig};
use mokly_catalogue::definition_provider::DefinitionProvider;
use mokly_catalogue::diagnostic::Issue;
use mokly_catalogue::discovery::{DiscoveryMock, Inventory, SourceFile, SourceKind};
use mokly_catalogue::error::CatalogueError;
use mokly_catalogue::preparation::{Builder, CatalogueBuilder};
use mokly_graph::cache::MemoryCache;
use mokly_render::runtime::Runtime;
use mokly_sidecar::definitions::Definitions;
use mokly_sidecar::diagnostics::{DefinitionCode, DefinitionDiagnostic};
use mokly_sidecar::methods::Call;
use mokly_sidecar::pool::PoolMock;
use mokly_sidecar::wire::MethodResult;
use mokly_source_interface::tree::SourceTreeMock;
use serde_json::json;
use unimock::{MockFn, Unimock, matching};

fn config() -> ResolvedConfig {
    ResolvedConfig {
        input: Config::default(),
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        modules: Default::default(),
        authored_inputs: vec![],
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
    }
}

fn file(path: &str, kind: SourceKind) -> SourceFile {
    SourceFile {
        path: path.into(),
        absolute: Path::new("/repo").join(path),
        identity: path.into(),
        root_index: 0,
        kind,
        excluded: false,
    }
}

/// Prepare duplicate native entries with authored controls in a source path.
pub(super) fn native_error() -> CatalogueError {
    let files = vec![
        file("specs/[second.md", SourceKind::Document),
        file("specs/\nfirst\t\u{1b}\u{85}Ω.md", SourceKind::Document),
    ];
    let mut inventory = Inventory::default();
    inventory
        .sources
        .extend(files.iter().map(|file| file.path.clone()));
    inventory.files.extend(files);
    let mock = Arc::new(Unimock::new((
        DiscoveryMock::discover
            .some_call(matching!(_, _))
            .returns(Ok(inventory)),
        SourceTreeMock::read
            .each_call(matching!(_))
            .answers(&|_, _| Ok(b"---\ntitle: Home\npath: home\n---\nHome".to_vec())),
    )));
    Builder {
        tree: mock.clone(),
        discovery: mock,
        definitions: Arc::new(Unimock::new(())),
    }
    .prepare(&config(), None)
    .unwrap_err()
}

/// Map a transported duplicate-export diagnostic through the real definition provider.
pub(super) fn sidecar_issues() -> Vec<Issue> {
    let bundle = serde_json::from_value(json!({
        "generation": "list-diagnostic",
        "modules": [],
        "compiled": {
            "identity": "list-diagnostic",
            "toolchain": "fixture",
            "reuseEvidence": { "complete": true, "durable": false, "inputs": {} },
            "code": "module.exports={}",
            "runtimeKey": "list-diagnostic-runtime",
            "dependencyRoots": [],
            "cssModules": [],
            "sources": {},
            "peers": {},
            "inputs": {},
            "metadataInputs": {},
            "inputDirectories": {},
            "metadataDirectories": {}
        }
    }))
    .unwrap();
    let described = Definitions {
        screens: vec![],
        components: vec![],
        pages: vec![],
        folders: vec![],
        use_cases: vec![],
        stories: vec![],
        diagnostics: vec![DefinitionDiagnostic {
            code: DefinitionCode::DuplicateExport,
            module: "specs/[second\n.mockup.ts".into(),
            export_name: Some("page".into()),
            variant_slug: None,
            message: "definition First\\u000a  Second\\u0009\\u001b\\u0085Ω\\u000a is exported by two entry modules:\n  specs/\\u000afirst\\u0009\\u001b\\u0085Ω.mockup.ts export page\n  specs/[second\\u000a.mockup.ts export page".into(),
        }],
    };
    let pool = Arc::new(Unimock::new((
        PoolMock::request
            .some_call(matching!(Call::Bundle(_)))
            .returns(Ok(MethodResult::Bundle(Box::new(bundle)))),
        PoolMock::request
            .some_call(matching!(Call::CssModules(_)))
            .returns(Ok(MethodResult::Empty)),
        PoolMock::request
            .some_call(matching!(Call::Describe(_)))
            .returns(Ok(MethodResult::Definitions(described))),
        PoolMock::release_generation
            .some_call(matching!("list-diagnostic", 0))
            .returns(()),
    )));
    let tree = Arc::new(Unimock::new(
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, _| Ok(None)),
    ));
    let runtime = Runtime::new(
        tree.clone(),
        tree,
        Arc::new(Unimock::new(())),
        pool,
        Arc::new(MemoryCache::new(0, 0)),
        Arc::new(Unimock::new(())),
        "test".into(),
        None,
    );
    runtime
        .describe(
            &config(),
            &[file("specs/[second\n.mockup.ts", SourceKind::Module)],
        )
        .unwrap()
        .issues
}
