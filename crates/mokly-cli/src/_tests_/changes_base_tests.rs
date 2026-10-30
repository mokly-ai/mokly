//! NativeBase sends historical bundle work to the injected head pool and reads the leased extraction.

use std::path::Path;
use std::sync::{Arc, Mutex};

use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_cli::cancellation::BuildCancellation;
use mokly_compare::base_render::{BaseProvider, BaseRequest, HistoricalSources};
use mokly_compare::cache_types::Lease;
use mokly_compare::comparison_steps::{Step, StepsMock};
use mokly_compare::dependency_types::{Resolved, Tier};
use mokly_compare::error::Error;
use mokly_compare::sources::SourcesMock;
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

type Events = Arc<Mutex<Vec<&'static str>>>;

/// A base tree with one configuration and one module entry; each configuration read is logged.
fn tree(events: Events) -> Unimock {
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
fn sources(events: Events, attaches: usize) -> Unimock {
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
fn steps(events: Events) -> Unimock {
    Unimock::new(
        StepsMock::step
            .each_call(matching!(Step::Rendering))
            .answers_arc(Arc::new(move |_, _| {
                events.lock().unwrap().push("rendering");
            })),
    )
}

fn lease() -> Arc<Lease> {
    Arc::new(Lease {
        directory: "/base".into(),
        guard: Box::new(Unimock::new(())),
    })
}

fn side(sources: Arc<Lease>) -> Arc<BaseSide> {
    Arc::new(BaseSide {
        sources,
        dependencies: Resolved {
            tier: Tier::Working,
            node_modules: "/deps/node_modules".into(),
            module_resolution: ModuleResolution::default(),
            warning: None,
            lease: None,
            repository_roots: Vec::new(),
        },
        identity: "commit".into(),
    })
}

/// Runs a base preparation whose bundle fails with a protocol handshake error.
fn prepare(
    input: Config,
    dependencies: Unimock,
    tree: Unimock,
    sources: Unimock,
    steps: Unimock,
) -> Error {
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
        dependencies: Arc::new(dependencies),
    };
    let config = ResolvedConfig {
        input,
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        roots: Vec::new(),
        authored_inputs: Vec::new(),
    };
    base.prepare(&BaseRequest {
        head: &Unimock::new(()),
        working_config: &config,
        repository: Arc::new(Unimock::new(())),
        commit: ObjectId::parse(&"a".repeat(40)).unwrap(),
        install_scripts: false,
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

#[test]
fn native_base_uses_the_head_pool_and_the_leased_base_source_root() {
    let events = Events::default();
    let dependencies = Unimock::new(
        BaseDependenciesMock::prepare
            .next_call(matching!((_, _, directories, unmapped, early) if *directories == [String::from("node_modules")] && unmapped.is_empty() && early.is_none()))
            .returns(Ok(side(lease()))),
    );
    let error = prepare(
        Config::default(),
        dependencies,
        tree(events.clone()),
        sources(events.clone(), 1),
        steps(events.clone()),
    );
    assert!(matches!(error, Error::Catalogue { .. }));
    assert!(events.lock().unwrap().ends_with(&["attach", "rendering"]));
}

#[test]
fn a_renderer_configuration_attaches_an_existing_extraction_before_the_configuration_loads() {
    let events = Events::default();
    let early = lease();
    let dependencies = Unimock::new((
        BaseDependenciesMock::existing_sources
            .next_call(matching!(_))
            .returns(Ok(Some(early.clone()))),
        BaseDependenciesMock::prepare
            .next_call(matching!((_, _, _, _, early) if early.as_ref().is_some_and(|lease| lease.directory == Path::new("/base"))))
            .answers_arc(Arc::new(move |_, _, _, _, _, early| Ok(side(early.unwrap())))),
    ));
    let error = prepare(
        Config {
            renderer: Some("renderer.tsx".into()),
            ..Config::default()
        },
        dependencies,
        tree(events.clone()),
        sources(events.clone(), 2),
        steps(events.clone()),
    );
    assert!(matches!(error, Error::Catalogue { .. }));
    let events = events.lock().unwrap();
    assert_eq!(events.first(), Some(&"attach"));
    assert!(events.contains(&"read configuration"));
    assert!(events.ends_with(&["attach", "rendering"]));
}

#[test]
fn a_failed_early_lookup_keeps_the_base_reads_on_git() {
    let events = Events::default();
    let dependencies = Unimock::new((
        BaseDependenciesMock::existing_sources
            .next_call(matching!(_))
            .returns(Err(Error::UnsafeCache {
                path: "/cache".into(),
            })),
        BaseDependenciesMock::prepare
            .next_call(matching!((_, _, _, _, early) if early.is_none()))
            .returns(Ok(side(lease()))),
    ));
    let error = prepare(
        Config {
            postcss: Some("postcss.config.mjs".into()),
            ..Config::default()
        },
        dependencies,
        tree(events.clone()),
        sources(events.clone(), 1),
        steps(events.clone()),
    );
    assert!(matches!(error, Error::Catalogue { .. }));
    let events = events.lock().unwrap();
    assert_eq!(events.first(), Some(&"read configuration"));
    assert!(events.ends_with(&["attach", "rendering"]));
}
