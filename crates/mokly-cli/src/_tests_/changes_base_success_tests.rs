//! A successful sidecar base keeps the scripts mode from its installed dependency tier.

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_cli::cancellation::BuildCancellation;
use mokly_compare::base_freshness::{DependencySelection, FreshnessMock};
use mokly_compare::base_render::{BaseProvider, BaseRequest, HistoricalSources};
use mokly_compare::cache_types::Lease;
use mokly_compare::comparison_steps::{Step, StepsMock};
use mokly_compare::dependency_types::{Resolved, Tier};
use mokly_compare::error::Error;
use mokly_compare::sources::SourcesMock;
use mokly_git::identity::ObjectId;
use mokly_git::repository::RepositoryMock;
use mokly_git::source_key::CheckoutIdentity;
use mokly_graph::workers::RenderWorkersMock;
use mokly_render::runtime::Runtime;
use mokly_render::side::BaseSide;
use mokly_sidecar::compiled::{CompiledGeneration, ReuseEvidence};
use mokly_sidecar::definitions::Definitions;
use mokly_sidecar::methods::{BundleCapture, Call, ModuleResolution};
use mokly_sidecar::pool::PoolMock;
use mokly_sidecar::results::{Bundle, Module};
use mokly_sidecar::wire::MethodResult;
use mokly_source_interface::tree::{Child, FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::base_dependencies::BaseDependenciesMock;
use crate::changes_base::NativeBase;
use crate::changes_freshness::PreparedDependencies;
use crate::serve_preparation_control::PreparationControlMock;

fn tree() -> Unimock {
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
        working_root: "/repo".into(),
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
        cache_namespace: None,
        identity: "commit".into(),
    });
    let captures = Arc::new(Mutex::new(Vec::new()));
    let captured = captures.clone();
    let pool = Unimock::new((
        PoolMock::request
            .next_call(matching!((call) if matches!(call, Call::Bundle(bundle)
                if Path::new(&bundle.params.source_root) == Path::new("/base")
                    && bundle.params.entry_files == ["specs/card.mockup.ts"])))
            .answers_arc(Arc::new(move |_, call| {
                if let Call::Bundle(bundle) = call {
                    captured.lock().unwrap().push((bundle.capture, bundle.plan.is_none()));
                }
                Ok(MethodResult::Bundle(Box::new(Bundle {
                plan: None,
                cache: None,
                unmapped_dependency_directories: None,
                epoch: 0,
                compiled: Arc::new(CompiledGeneration {
                    toolchain: "fixture".into(),
                    reuse_evidence: Arc::new(ReuseEvidence { uncaptured: None, durable: true, complete: true, inputs: Default::default() }),
                    identity: "base-bundle".into(),
                    code: "module.exports={}".into(),
                    runtime_key: "fixture-runtime".into(),
                    dependency_roots: Vec::new(),
                    css_modules: Vec::new(),
                    sources: BTreeMap::new(),
                    peers: BTreeMap::new(),
                    inputs: BTreeMap::new(),
                    metadata_inputs: BTreeMap::new(),
                    input_directories: BTreeMap::new(),
                    metadata_directories: BTreeMap::new(),
                    unmapped_dependency_directories: None,
                }),
                generation: "base-bundle".into(),
                modules: vec![Module {
                    path: "specs/card.mockup.ts".into(),
                    imports: Vec::new(),
                    digest: Some("source".into()),
                }],
            })))
            })),
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
            }))),
        PoolMock::request
            .next_call(matching!((call) if matches!(call, Call::Bindings(params) if params.generation == "base-bundle")))
            .returns(Ok(MethodResult::Empty)),
        PoolMock::release_generation
            .next_call(matching!("base-bundle", 0))
            .returns(()),
    ));
    let waits = Arc::new(AtomicUsize::new(0));
    let waited = waits.clone();
    let provider: &dyn BaseProvider = &NativeBase {
        preparation: Some(Arc::new(Unimock::new((
            PreparationControlMock::selected
                .some_call(matching!((true, directories, unmapped) if directories.is_empty() && unmapped.is_empty()))
                .returns(()),
            PreparationControlMock::wait
                .each_call(matching!())
                .answers_arc(Arc::new(move |_| {
                    waited.fetch_add(1, Ordering::Relaxed);
                    Err(Error::Cancelled)
                })),
        )).no_verify_in_drop())),
        runtime: Arc::new({
            let mut runtime = Runtime::new(
            Arc::new(Unimock::new(())),
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
            );
            runtime.bundle_capture = BundleCapture::ServeEdit;
            runtime.with_serve_edit_plans()
        }),
        cancellation: Arc::new(BuildCancellation::new(Arc::new(Unimock::new(())))),
        freshness: Some(Arc::new(Unimock::new(FreshnessMock::record
            .some_call(matching!((checkout, _, roots, _) if checkout.digest == "checkout" && roots.is_none()))
            .returns(Ok(None))))),
        dependencies: Arc::new(Unimock::new(
            BaseDependenciesMock::prepare
                .next_call(matching!((request, _, _, early)
                    if !request.install_scripts && early.is_none()))
                .returns(Ok(PreparedDependencies { side, selection: Some(DependencySelection::default()) })),
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
            repository: Arc::new(Unimock::new(
                RepositoryMock::checkout_identity
                    .some_call(matching!(_))
                    .returns(Ok(CheckoutIdentity {
                        digest: "checkout".into(),
                        filtered: false,
                    })),
            )),
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
            steps: Arc::new(Unimock::new(
                StepsMock::step
                    .some_call(matching!(Step::Rendering))
                    .returns(()),
            )),
        })
        .unwrap();
    assert_eq!(
        *captures.lock().unwrap(),
        [(Some(BundleCapture::Full), true)]
    );
    assert_eq!(waits.load(Ordering::Relaxed), 0);
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
