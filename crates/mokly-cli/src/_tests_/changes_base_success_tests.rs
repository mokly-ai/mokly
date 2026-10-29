//! A successful sidecar base keeps the scripts mode from its installed dependency tier.

use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_cli::cancellation::BuildCancellation;
use mokly_compare::base_render::{BaseProvider, BaseRequest, HistoricalSources};
use mokly_compare::cache_types::Lease;
use mokly_compare::dependency_types::{Resolved, Tier};
use mokly_compare::sources::SourcesMock;
use mokly_git::identity::ObjectId;
use mokly_graph::workers::RenderWorkersMock;
use mokly_render::runtime::Runtime;
use mokly_render::side::BaseSide;
use mokly_sidecar::definitions::Definitions;
use mokly_sidecar::methods::{Call, ModuleResolution};
use mokly_sidecar::pool::PoolMock;
use mokly_sidecar::results::{Bundle, Module};
use mokly_sidecar::wire::MethodResult;
use mokly_source_interface::tree::{Child, FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::base_dependencies::BaseDependenciesMock;
use crate::changes_base::NativeBase;

fn tree() -> Unimock {
    Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, path| {
                let kind = match path.to_str().unwrap() {
                    "/repo" | "/repo/specs" => FileKind::Directory,
                    "/repo/mokly.config.json" | "/repo/specs/card.mockup.ts" => FileKind::File,
                    _ => return Ok(None),
                };
                Ok(Some(Node {
                    identity: path.into(),
                    kind,
                    lexical_kind: kind,
                }))
            }),
        SourceTreeMock::read
            .next_call(matching!((path) if *path == Path::new("/repo/mokly.config.json")))
            .returns(Ok(b"{}".to_vec())),
        SourceTreeMock::prefetch
            .next_call(matching!(_))
            .returns(Ok(())),
        SourceTreeMock::children
            .each_call(matching!((path) if *path == Path::new("/repo/specs")))
            .answers(&|_, _| {
                Ok(vec![Child {
                    name: "card.mockup.ts".into(),
                    kind: FileKind::File,
                }])
            }),
    ))
}

#[test]
fn native_base_success_keeps_scripts_off_after_a_tier_two_install() {
    let side = Arc::new(BaseSide {
        sources: Arc::new(Lease {
            directory: "/base".into(),
            guard: Box::new(Unimock::new(())),
        }),
        dependencies: Resolved {
            tier: Tier::Installed,
            node_modules: "/deps/node_modules".into(),
            module_resolution: ModuleResolution::default(),
            warning: None,
            lease: None,
            repository_roots: Vec::new(),
        },
        identity: "commit".into(),
    });
    let pool = Unimock::new((
        PoolMock::request
            .next_call(matching!((call) if matches!(call, Call::Bundle(bundle)
                if bundle.source_root == "/base"
                    && bundle.entry_files == ["specs/card.mockup.ts"])))
            .returns(Ok(MethodResult::Bundle(Bundle {
                unmapped_dependency_directories: None,
                epoch: 0,
                compiled: None,
                generation: "base-bundle".into(),
                modules: vec![Module {
                    path: "specs/card.mockup.ts".into(),
                    imports: Vec::new(),
                    digest: Some("source".into()),
                }],
                warnings: Vec::new(),
            }))),
        PoolMock::request
            .next_call(matching!((call) if matches!(call, Call::CssModules(params) if params.generation == "base-bundle")))
            .returns(Ok(MethodResult::Empty)),
        PoolMock::request
            .next_call(matching!((call) if matches!(call, Call::Describe(params) if params.generation == "base-bundle")))
            .returns(Ok(MethodResult::Definitions(Definitions {
                screens: Vec::new(),
                pages: Vec::new(),
                use_cases: Vec::new(),
                folders: Vec::new(),
                components: Vec::new(),
                stories: Vec::new(),
                diagnostics: Vec::new(),
                warnings: Vec::new(),
            }))),
        PoolMock::request
            .next_call(matching!((call) if matches!(call, Call::Bindings(params) if params.generation == "base-bundle")))
            .returns(Ok(MethodResult::Empty)),
        PoolMock::release_generation
            .next_call(matching!("base-bundle", 0))
            .returns(()),
    ));
    let provider: &dyn BaseProvider = &NativeBase {
        runtime: Arc::new(Runtime::new(
            Arc::new(Unimock::new(())),
            Arc::new(Unimock::new(())),
            Arc::new(pool),
            Arc::new(Unimock::new(())),
            Arc::new(Unimock::new(
                RenderWorkersMock::stylesheets
                    .next_call(matching!((roots, _) if roots.is_empty()))
                    .returns(Ok(Vec::new())),
            )),
            "test".into(),
            None,
        )),
        cancellation: Arc::new(BuildCancellation::new(Arc::new(Unimock::new(())))),
        dependencies: Arc::new(Unimock::new(
            BaseDependenciesMock::prepare
                .next_call(matching!((request, _, _, _, early)
                    if !request.install_scripts && early.is_none()))
                .returns(Ok(side)),
        )),
    };
    let config = ResolvedConfig {
        input: Config::default(),
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        roots: Vec::new(),
        authored_inputs: Vec::new(),
    };
    let prepared = provider
        .prepare(&BaseRequest {
            head: &Unimock::new(()),
            working_config: &config,
            repository: Arc::new(Unimock::new(())),
            commit: ObjectId::parse(&"a".repeat(40)).unwrap(),
            install_scripts: false,
            sources: HistoricalSources {
                tree: Arc::new(tree()),
                sources: Arc::new(Unimock::new(
                    SourcesMock::attach
                        .next_call(matching!((lease) if lease.directory == Path::new("/base")))
                        .returns(Ok(())),
                )),
                failures: Arc::new(Unimock::new(())),
            },
        })
        .unwrap();
    assert!(prepared.scripts_off);
    assert_eq!(
        prepared
            .generation
            .catalogue()
            .javascript
            .generation
            .as_ref()
            .unwrap()
            .id,
        "base-bundle"
    );
}
