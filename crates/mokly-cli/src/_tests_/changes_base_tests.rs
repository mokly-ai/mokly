//! NativeBase sends historical bundle work to the injected head pool.

use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_cli::cancellation::BuildCancellation;
use mokly_compare::base_render::{BaseProvider, BaseRequest, HistoricalSources};
use mokly_compare::cache_types::Lease;
use mokly_compare::dependency_types::{Resolved, Tier};
use mokly_compare::error::Error;
use mokly_git::identity::ObjectId;
use mokly_render::runtime::Runtime;
use mokly_render::side::BaseSide;
use mokly_sidecar::error::ProtocolError;
use mokly_sidecar::methods::{Call, ModuleResolution};
use mokly_sidecar::pool::PoolMock;
use mokly_source_interface::tree::{Child, FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::base_dependencies::BaseDependenciesMock;
use crate::changes_base::NativeBase;

#[test]
fn native_base_uses_the_head_pool_and_the_leased_base_source_root() {
    let tree = Arc::new(Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, path| {
                let kind = if path == Path::new("/repo") || path == Path::new("/repo/specs") {
                    FileKind::Directory
                } else if path == Path::new("/repo/mokly.config.json")
                    || path == Path::new("/repo/specs/card.mockup.ts")
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
            .each_call(matching!((path) if *path == Path::new("/repo/mokly.config.json")))
            .answers(&|_, _| Ok(b"{}".to_vec())),
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
    )));
    let head = Arc::new(Runtime::new(
        Arc::new(Unimock::new(())), Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(PoolMock::request.next_call(matching!((call) if matches!(call,
            Call::Bundle(bundle) if bundle.source_root == "/base" && bundle.entry_files == ["specs/card.mockup.ts"]
        ))).returns(Err(mokly_sidecar::error::Error::Protocol(ProtocolError::Handshake))))),
        Arc::new(Unimock::new(())), Arc::new(Unimock::new(())), "test".into(), None,
    ));
    head.dependency_usage.record(
        &[("node_modules".into(), "node_modules".into())].into(),
        "node_modules/x.js",
    );
    let base = NativeBase {
        runtime: head,
        cancellation: Arc::new(BuildCancellation::new(Arc::new(Unimock::new(())))),
        dependencies: Arc::new(Unimock::new(
            BaseDependenciesMock::prepare
                .next_call(matching!((_, _, directories, unmapped) if *directories == [String::from("node_modules")] && unmapped.is_empty()))
                .returns(Ok(Arc::new(BaseSide {
                    sources: Arc::new(Lease {
                        directory: "/base".into(),
                        guard: Box::new(Unimock::new(())),
                    }),
                    dependencies: Resolved {
                        tier: Tier::Working,
                        node_modules: "/deps/node_modules".into(),
                        module_resolution: ModuleResolution::default(),
                        warning: None,
                        lease: None,
                        repository_roots: Vec::new(),
                    },
                    identity: "commit".into(),
                }))),
        )),
    };
    let config = ResolvedConfig {
        input: Config::default(),
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        roots: Vec::new(),
        authored_inputs: Vec::new(),
    };
    let result = base.prepare(&BaseRequest {
        head: &Unimock::new(()),
        working_config: &config,
        repository: Arc::new(Unimock::new(())),
        commit: ObjectId::parse(&"a".repeat(40)).unwrap(),
        install_scripts: false,
        sources: HistoricalSources {
            tree,
            sources: Arc::new(Unimock::new(())),
            failures: Arc::new(Unimock::new(())),
        },
    });
    assert!(matches!(result, Err(Error::Catalogue { .. })));
}
