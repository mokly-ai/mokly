//! NativeBase sends historical bundle work to the injected head pool and reads the leased extraction.

use std::path::Path;
use std::sync::{Arc, Mutex};

use mokly_catalogue::config_types::{Config, ResolvedConfig, ResolvedModules};
use mokly_cli::cancellation::BuildCancellation;
use mokly_compare::base_freshness::DependencySelection;
use mokly_compare::base_render::{
    BasePreparationError, BaseProvider, BaseRequest, HistoricalSources,
};
use mokly_compare::cache_types::Lease;
use mokly_compare::comparison_steps::{Step, StepsMock};
use mokly_compare::dependency_types::{Resolved, Tier};
use mokly_compare::sources::SourcesMock;
use mokly_git::identity::ObjectId;
use mokly_git::repository::RepositoryMock;
use mokly_git::source_key::CheckoutIdentity;
use mokly_render::runtime::Runtime;
use mokly_render::side::BaseSide;
use mokly_sidecar::error::ProtocolError;
use mokly_sidecar::methods::{Call, ModuleResolution};
use mokly_sidecar::pool::PoolMock;
use mokly_source_interface::tree::{Child, FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::base_render_admission::ImmediateBaseRenders;
use crate::changes_base::NativeBase;
use crate::changes_freshness::PreparedDependencies;

pub(super) type Events = Arc<Mutex<Vec<&'static str>>>;

/// A base tree with one configuration and one module entry; each configuration read is logged.
pub(super) fn tree(events: Events) -> Unimock {
    Unimock::new((
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
            .answers_arc(Arc::new(move |_, _| {
                events.lock().unwrap().push("read configuration");
                Ok(b"{}".to_vec())
            })),
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

/// Base sources that log each attached extraction directory.
pub(super) fn sources(events: Events, attaches: usize) -> Unimock {
    Unimock::new(
        SourcesMock::attach
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, lease| {
                assert_eq!(lease.directory, Path::new("/base"));
                events.lock().unwrap().push("attach");
                Ok(())
            }))
            .n_times(attaches),
    )
}

/// Comparison steps that log the rendering step; any other step fails the test.
pub(super) fn steps(events: Events) -> Unimock {
    Unimock::new(
        StepsMock::step
            .each_call(matching!(Step::Rendering))
            .answers_arc(Arc::new(move |_, _| {
                events.lock().unwrap().push("rendering");
            })),
    )
}

pub(super) fn lease() -> Arc<Lease> {
    Arc::new(Lease {
        directory: "/base".into(),
        guard: Box::new(Unimock::new(())),
    })
}

pub(super) fn side(sources: Arc<Lease>) -> PreparedDependencies {
    side_with_tier(sources, Tier::Working)
}

pub(super) fn side_with_tier(sources: Arc<Lease>, tier: Tier) -> PreparedDependencies {
    PreparedDependencies {
        selection: Some(DependencySelection::default()),
        side: Arc::new(BaseSide {
            working_root: "/repo".into(),
            sources,
            dependencies: Resolved {
                tier,
                node_modules: "/deps/node_modules".into(),
                module_resolution: ModuleResolution::default(),
                warning: None,
                lease: None,
                repository_roots: Vec::new(),
            },
            cache_namespace: None,
            identity: "commit".into(),
        }),
    }
}

/// Runs a base preparation whose bundle fails with a protocol handshake error.
pub(super) fn prepare(
    input: Config,
    dependencies: Unimock,
    tree: Unimock,
    sources: Unimock,
    install_scripts: bool,
    steps: Unimock,
) -> BasePreparationError {
    let head = Arc::new(Runtime::new(
        Arc::new(Unimock::new(())), Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(PoolMock::request.next_call(matching!((call) if matches!(call,
            Call::Bundle(bundle) if bundle.params.source_root == "/base" && bundle.params.entry_files == ["specs/card.mockup.ts"]
        ))).returns(Err(mokly_sidecar::error::Error::Protocol(ProtocolError::Handshake))))),
        Arc::new(Unimock::new(())), Arc::new(Unimock::new(())), "test".into(), None,
    ));
    head.dependency_usage.record(
        &[("node_modules".into(), "node_modules".into())].into(),
        "node_modules/x.js",
    );
    let base = NativeBase {
        validation: None,
        admission: Arc::new(ImmediateBaseRenders),
        runtime: head,
        cancellation: Arc::new(BuildCancellation::new(Arc::new(Unimock::new(())))),
        dependencies: Arc::new(dependencies),
        freshness: Some(Arc::new(Unimock::new(()))),
    };
    let config = ResolvedConfig {
        modules: ResolvedModules {
            renderer: input.renderer.clone(),
            postcss: input.postcss.clone(),
            ..ResolvedModules::default()
        },
        input,
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        roots: Vec::new(),
        authored_inputs: Vec::new(),
    };
    base.prepare(&BaseRequest {
        head: &Unimock::new(()),
        working_config: &config,
        repository: Arc::new(Unimock::new(
            RepositoryMock::checkout_identity
                .some_call(matching!(_))
                .returns(Ok(CheckoutIdentity {
                    digest: "checkout".into(),
                    filtered: false,
                })),
        )),
        commit: ObjectId::parse(&"a".repeat(40)).unwrap(),
        install_scripts,
        sources: HistoricalSources {
            tree: Arc::new(tree),
            sources: Arc::new(sources),
            failures: Arc::new(Unimock::new(())),
        },
        steps: Arc::new(steps),
    })
    .err()
    .unwrap()
}
