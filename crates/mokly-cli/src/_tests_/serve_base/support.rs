//! Strict in-memory services shared by the Serve retention tests.

use std::sync::Arc;

use mokly_cli::cancellation::ServeCancellation;
use mokly_compare::base_freshness::{DependencySelection, Freshness, PreparationInputs};
use mokly_compare::base_render::BaseProvider;
use mokly_compare::base_retention::KeptBase;
use mokly_compare::base_selection::PinnedBase;
use mokly_compare::source_failures::SourceFailuresMock;
use mokly_git::identity::ObjectId;
use mokly_git::source_key::CheckoutIdentity;
use mokly_graph::types::{RenderGeneration, RenderGenerationMock};
use mokly_render::runtime::Runtime;
use mokly_server::changes::ChangeToken;
use unimock::{MockFn, Unimock, matching};

use crate::serve_base::{BaseSlot, ServeBase};
use crate::serve_base_cancel::PreparingBase;
use crate::serve_capture_cancel::CaptureCancellation;
use crate::serve_changes_base::CombinedCancel;
use crate::warning_support::catalogue;

/// Explicit Serve owner and the independent reader and base lifetimes.
pub(super) struct Fixture {
    /// Only this fixture owns the shared retention slot.
    pub(super) slot: Arc<BaseSlot>,
    /// Production retention policy under test.
    pub(super) provider: Arc<ServeBase>,
    /// Command stop remains active after keep.
    pub(super) command: Arc<ServeCancellation>,
    /// Original classification publication guard.
    pub(super) origin: Arc<ChangeToken>,
    /// The source's current selected-capture scope.
    pub(super) operation: Arc<CaptureCancellation>,
    /// Shared by the fresh base services until and after keep.
    pub(super) lifetime: Arc<PreparingBase>,
}

impl Fixture {
    /// Compose real cancellation and retention around strict service boundaries.
    pub(super) fn new(
        slot: Arc<BaseSlot>,
        freshness: Arc<dyn Freshness>,
        inner: Arc<dyn BaseProvider>,
        runtime: Arc<Runtime>,
    ) -> Self {
        let command = Arc::new(ServeCancellation::default());
        let origin = Arc::new(ChangeToken::default());
        let operation = Arc::new(CaptureCancellation::default());
        let reader = Arc::new(CombinedCancel {
            command: command.clone(),
            generation: origin.clone(),
            operation: operation.clone(),
        });
        let lifetime = Arc::new(PreparingBase::new(reader.clone()));
        Self {
            provider: Arc::new(ServeBase {
                preparation: None,
                slot: Arc::downgrade(&slot),
                freshness,
                inner,
                runtime,
                reader,
                origin: origin.clone(),
                lifetime: lifetime.clone(),
            }),
            slot,
            command,
            origin,
            operation,
            lifetime,
        }
    }
}

/// A runtime whose IO services are unused in a slot-policy test.
pub(super) fn runtime() -> Arc<Runtime> {
    Arc::new(Runtime::new(
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        "test".into(),
        None,
    ))
}

/// One merge base, with a repository that does no IO.
pub(super) fn selected(commit: &str) -> PinnedBase {
    PinnedBase {
        repository: Arc::new(Unimock::new(())),
        commit: ObjectId::parse(&commit.repeat(40)).unwrap(),
        reference: "main".into(),
    }
}

/// Eligible original evidence with distinct HTML and sidecar selection modes.
pub(super) fn inputs(html: bool) -> PreparationInputs {
    PreparationInputs {
        checkout: CheckoutIdentity {
            digest: "before".into(),
            filtered: false,
        },
        selection: DependencySelection {
            paths: html.then(Vec::new),
            ..DependencySelection::default()
        },
        installations: Default::default(),
        installed_modules: Default::default(),
    }
}

/// Strict keep-time seams are present only when evidence permits inspection.
pub(super) fn base(freshness: Option<PreparationInputs>) -> Arc<KeptBase> {
    let eligible = freshness
        .as_ref()
        .is_some_and(|inputs| !inputs.checkout.filtered);
    Arc::new(KeptBase {
        generation: Arc::new(if eligible {
            Unimock::new(
                RenderGenerationMock::catalogue
                    .some_call(matching!())
                    .returns(catalogue(Vec::new())),
            )
        } else {
            Unimock::new(())
        }),
        failures: Arc::new(if eligible {
            Unimock::new(
                SourceFailuresMock::failure
                    .each_call(matching!())
                    .answers(&|_| None),
            )
        } else {
            Unimock::new(())
        }),
        scripts_off: true,
        freshness,
    })
}

/// Only HTML freshness and preparation inspect the head catalogue.
pub(super) fn head(html: bool) -> Arc<dyn RenderGeneration> {
    Arc::new(if html {
        Unimock::new(
            RenderGenerationMock::catalogue
                .each_call(matching!())
                .returns(catalogue(Vec::new())),
        )
    } else {
        Unimock::new(())
    })
}
