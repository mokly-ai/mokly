//! A complete early source lease reaches admission before historical discovery.

use std::path::Path;
use std::sync::{Arc, Mutex};

use mokly_catalogue::config_types::{Config, ResolvedConfig, ResolvedModules};
use mokly_cli::cancellation::ServeCancellation;
use mokly_compare::base_render::HistoricalSources;
use mokly_compare::base_sources::BaseSourcesRequest;
use mokly_git::identity::ObjectId;
use mokly_render::runtime::Runtime;
use mokly_source_interface::tree::{Child, FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::base_dependencies::BaseDependenciesMock;
use crate::base_render_admission::ImmediateBaseRenders;
use crate::changes_base::NativeBase;
use crate::changes_base_sources::NativePhases;
use crate::changes_source_admission::{SourceAdmissionMock, SourceCache};

use super::base_source_support::{Events, lease, sources};

#[test]
fn eager_complete_source_lease_reaches_admission_before_discovery() {
    let events = Events::default();
    let states = Arc::new(Mutex::new(Vec::new()));
    let recorded = states.clone();
    let observed = events.clone();
    let admission = Arc::new(
        Unimock::new(
            SourceAdmissionMock::enter
                .some_call(matching!(_))
                .answers_arc(Arc::new(move |_, state| {
                    recorded.lock().unwrap().push(state);
                    observed.lock().unwrap().push("admission");
                    Ok(())
                })),
        )
        .no_verify_in_drop(),
    );
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
        dependencies: Arc::new(Unimock::new((
            BaseDependenciesMock::existing_sources
                .some_call(matching!(_))
                .returns(Ok(Some(lease()))),
            crate::dependency_source_support::sources(true),
        ))),
    };
    let config = ResolvedConfig {
        input: Config::default(),
        modules: ResolvedModules {
            renderer: Some("renderer.tsx".into()),
            postcss: None,
        },
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        roots: Vec::new(),
        authored_inputs: Vec::new(),
    };
    let sources = HistoricalSources {
        tree: Arc::new(source_tree(events.clone())),
        sources: Arc::new(sources(events.clone(), 1)),
        failures: Arc::new(Unimock::new(())),
    };
    let result = base.sources(
        &BaseSourcesRequest {
            working_config: &config,
            repository: Arc::new(Unimock::new(())),
            commit: ObjectId::parse(&"a".repeat(40)).unwrap(),
            sources: &sources,
            install_scripts: false,
            steps: Arc::new(Unimock::new(())),
        },
        None,
        Some(admission),
    );
    assert_eq!(result.unwrap().inventory.files.len(), 1);
    assert_eq!(*states.lock().unwrap(), [SourceCache::Leased]);
    assert_eq!(
        *events.lock().unwrap(),
        ["attach", "read configuration", "admission", "discovery"]
    );
}

fn source_tree(events: Events) -> Unimock {
    let reads = events.clone();
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
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                reads.lock().unwrap().push("read configuration");
                Ok(b"{}".to_vec())
            })),
        SourceTreeMock::children
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                events.lock().unwrap().push("discovery");
                Ok(vec![Child {
                    name: "card.mockup.ts".into(),
                    kind: FileKind::File,
                }])
            })),
    ))
}
