//! The native adoption fixture and its working input read record.

use std::sync::{Arc, Mutex};

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_cli::cancellation::ServeCancellation;
use mokly_compare::base_freshness::{DependencySelection, Freshness, PreparationInputs};
use mokly_compare::base_render::{HistoricalSources, PreparedBase};
use mokly_compare::base_retention::BaseRetentionRequest;
use mokly_compare::base_selection::PinnedBase;
use mokly_compare::inputs::Inputs;
use mokly_compare::working_inputs::{WorkingInputs, WorkingInputsMock};
use mokly_git::identity::{ObjectId, RepoPath};
use mokly_git::repository::RepositoryMock;
use mokly_git::source_key::CheckoutIdentity;
use mokly_graph::types::RenderGenerationMock;
use mokly_render::runtime::Runtime;
use mokly_server::changes::ChangeToken;
use unimock::{MockFn, Unimock, matching};

use crate::serve_base_cancel::PreparingBase;
use crate::serve_base_key::BaseKey;
use crate::serve_changes_base::CombinedCancel;
use crate::serve_eager_admission::PreparationAdmission;
use crate::serve_eager_cancel::OriginCancellation;
use crate::serve_eager_diagnostics::RootDiagnostics;
use crate::serve_eager_events::OrderedEvents;
use crate::serve_eager_evidence::{HeadEvidence, NativeEvidence};
use crate::serve_eager_validation::ProvenValidation;
use crate::serve_eager_work::{Context, NativePreparation, PendingServices, WorkState};
use crate::serve_eager_workers::DeferredWorkers;
use crate::warning_support::{catalogue, config};

/// Reads that adoption makes through Git or the working input reader.
#[derive(Debug, PartialEq, Eq)]
pub(super) enum Read {
    /// Current checkout identity.
    Checkout,
    /// Inventory of all working dependency inputs.
    Working,
    /// Read of the supplied governing paths.
    Paths(Vec<RepoPath>),
}

/// Injected repository and working readers common to the adoption tests.
pub(super) struct Fixture {
    /// Config that owns the pending preparation.
    pub(super) config: ResolvedConfig,
    selected: Arc<PinnedBase>,
    head: Unimock,
    /// The same reader can serve both adoption and freshness checks.
    pub(super) working: Arc<dyn WorkingInputs>,
    /// Ordered reads through both IO boundaries.
    pub(super) reads: Arc<Mutex<Vec<Read>>>,
}

impl Fixture {
    /// Prepare the head, checkout, and working input mocks.
    pub(super) fn new() -> Self {
        let reads = Arc::new(Mutex::new(Vec::new()));
        let repository = Unimock::new(
            RepositoryMock::checkout_identity
                .each_call(matching!(_))
                .answers_arc({
                    let reads = reads.clone();
                    Arc::new(move |_, _| {
                        reads.lock().unwrap().push(Read::Checkout);
                        Ok(checkout())
                    })
                }),
        );
        let working = Unimock::new((
            WorkingInputsMock::read
                .each_call(matching!(_, _, _))
                .answers_arc({
                    let reads = reads.clone();
                    Arc::new(move |_, _, inputs, _| {
                        reads.lock().unwrap().push(Read::Working);
                        Ok(inputs.clone())
                    })
                }),
            WorkingInputsMock::read_paths
                .each_call(matching!(_, _, _, _))
                .answers_arc({
                    let reads = reads.clone();
                    Arc::new(move |_, _, inputs, paths, _| {
                        reads.lock().unwrap().push(Read::Paths(paths.to_vec()));
                        Ok(inputs.clone())
                    })
                }),
        ))
        .no_verify_in_drop();
        Self {
            config: config(),
            selected: Arc::new(PinnedBase {
                reference: "main".into(),
                commit: ObjectId::parse(&"a".repeat(40)).unwrap(),
                repository: Arc::new(repository),
            }),
            head: Unimock::new(
                RenderGenerationMock::catalogue
                    .each_call(matching!())
                    .returns(catalogue(Vec::new())),
            ),
            working: Arc::new(working),
            reads,
        }
    }

    /// Request the prepared base for the same head and pinned checkout.
    pub(super) fn request(&self) -> BaseRetentionRequest<'_> {
        BaseRetentionRequest {
            selected: &self.selected,
            working_config: &self.config,
            head: &self.head,
            install_scripts: false,
        }
    }

    /// Seed a ready preparation to exercise real adoption without base IO.
    pub(super) fn work(
        &self,
        selection: DependencySelection,
        freshness: Arc<dyn Freshness>,
    ) -> NativePreparation {
        let empty = || Arc::new(Unimock::new(()));
        let origin = Arc::new(OriginCancellation::default());
        let command = Arc::new(ServeCancellation::default());
        let evidence = Arc::new(NativeEvidence {
            key: BaseKey::new(&self.request()).unwrap(),
            working: self.working.clone(),
            inputs: Some(dependency_inputs()),
            checkout: Some(checkout()),
            head: Mutex::new(Some(HeadEvidence {
                directories: Vec::new(),
                unmapped: Vec::new(),
                catalogue: Vec::new(),
            })),
        });
        NativePreparation {
            config: self.config.clone(),
            base: None,
            install_scripts: false,
            lookup: empty(),
            sources: empty(),
            providers: empty(),
            availability: empty(),
            working: self.working.clone(),
            freshness,
            origin: origin.clone(),
            lifetime: Arc::new(PreparingBase::owned(
                Arc::new(CombinedCancel {
                    command: command.clone(),
                    generation: origin.clone(),
                    operation: Arc::new(ChangeToken::default()),
                }),
                origin.clone(),
            )),
            events: Arc::new(OrderedEvents::default()),
            diagnostics: Arc::new(RootDiagnostics::new(empty())),
            runtime: Arc::new(Runtime::new(
                empty(),
                empty(),
                empty(),
                empty(),
                empty(),
                empty(),
                "test".into(),
                None,
            )),
            state: Mutex::new(Some(WorkState::Ready {
                context: Context {
                    selected: self.selected.clone(),
                    sources: HistoricalSources {
                        tree: empty(),
                        sources: empty(),
                        failures: empty(),
                    },
                    services: PendingServices {
                        source_admission: empty(),
                        provider: empty(),
                        validation: ProvenValidation::shared(
                            Arc::new(PreparationAdmission::default()),
                            origin,
                            empty(),
                        ),
                        workers: Arc::new(DeferredWorkers {
                            preparation: empty(),
                            capture: Mutex::default(),
                        }),
                    },
                    evidence: evidence.clone(),
                    root: None,
                },
                prepared: Box::new(Ok(PreparedBase {
                    generation: empty(),
                    prefetch: None,
                    scripts_off: false,
                    freshness: Some(PreparationInputs {
                        checkout: checkout(),
                        selection,
                        installations: Default::default(),
                        installed_modules: Default::default(),
                    }),
                })),
            })),
            consumed: Mutex::default(),
            accepted: false.into(),
            command,
            activity: empty(),
            guard: Mutex::new(Some(evidence)),
        }
    }
}

/// The checkout identity sampled before preparation and still current at adoption.
pub(super) fn checkout() -> CheckoutIdentity {
    CheckoutIdentity {
        digest: "checkout".into(),
        filtered: false,
    }
}

/// The working dependency inputs that eager preparation compared.
pub(super) fn dependency_inputs() -> Inputs {
    let mut inputs = Inputs::default();
    inputs.files.insert(
        RepoPath::parse("package-lock.json").unwrap(),
        b"current lock".to_vec(),
    );
    inputs
}
