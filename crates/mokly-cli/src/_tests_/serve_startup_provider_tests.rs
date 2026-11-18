//! Held startup diagnostics follow authoritative retained-base acceptance.

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::diagnostic::Warning;
use mokly_cli::cancellation::{Cancellation, ServeCancellation};
use mokly_compare::base_render::{BaseProvider, BaseProviderMock};
use mokly_compare::base_retention::{BaseRetentionRequest, BaseReuse, KeptBase};
use mokly_compare::base_selection::PinnedBase;
use mokly_compare::base_startup::PreparedOutcome;
use mokly_compare::cache_types::ReporterMock;
use mokly_compare::error::{Error, Result};
use mokly_git::identity::ObjectId;
use mokly_graph::types::RenderGeneration;
use mokly_server::changes::{ChangeCancellation, ChangeToken};
use unimock::{MockFn, Unimock, matching};

use crate::serve_base_cancel::PreparingBase;
use crate::serve_base_key::BaseKey;
use crate::serve_capture_cancel::CaptureCancellation;
use crate::serve_changes_base::CombinedCancel;
use crate::serve_startup_base::{StartupHandoff, StartupReady, StartupState};
use crate::serve_startup_provider::StartupProvider;
use crate::warning_support::{config, warning};

struct Fixture {
    provider: StartupProvider,
    head: Arc<dyn RenderGeneration>,
    config: ResolvedConfig,
    selected: PinnedBase,
    cache: Arc<Mutex<Vec<PathBuf>>>,
    startup: Arc<ChangeToken>,
    caller: Arc<ChangeToken>,
    lifetime: Arc<PreparingBase>,
}

impl Fixture {
    fn new(result: Result<PreparedOutcome>, inner: Arc<dyn BaseProvider>) -> Self {
        let head: Arc<dyn RenderGeneration> = Arc::new(Unimock::new(()));
        let config = config();
        let selected = PinnedBase {
            reference: "main".into(),
            commit: ObjectId::parse(&"a".repeat(40)).unwrap(),
            repository: Arc::new(Unimock::new(())),
        };
        let startup = Arc::new(ChangeToken::default());
        let caller = Arc::new(ChangeToken::default());
        let command = Arc::new(ServeCancellation::default());
        let cancellation = |generation: Arc<ChangeToken>| {
            Arc::new(CombinedCancel {
                command: command.clone(),
                generation,
                operation: Arc::new(CaptureCancellation::default()),
            })
        };
        let lifetime = Arc::new(PreparingBase::new(cancellation(startup.clone())));
        let state = Arc::new(StartupState::default());
        state.begin(head.clone(), startup.clone());
        let cache = Arc::new(Mutex::new(Vec::new()));
        let opened = cache.clone();
        let provider =
            StartupProvider {
                inner,
                handoff: state.clone(),
                head: head.clone(),
                cancel: caller.clone(),
                cancellation: cancellation(caller.clone()),
                warnings: Arc::default(),
                pending: Mutex::default(),
                reporter: Arc::new(
                    Unimock::new(ReporterMock::opened.each_call(matching!(_)).answers_arc(
                        Arc::new(move |_, path| {
                            opened.lock().unwrap().push(path.to_owned());
                        }),
                    ))
                    .no_verify_in_drop(),
                ),
            };
        let fixture = Self {
            provider,
            head,
            config,
            selected,
            cache,
            startup,
            caller,
            lifetime: lifetime.clone(),
        };
        state.selected(BaseKey::new(&fixture.request()).unwrap());
        state.complete(StartupReady {
            result,
            warnings: vec![diagnostic()],
            cache: Some("/startup-cache".into()),
            lifetime: Some(lifetime),
        });
        state.finished();
        fixture
    }

    fn request(&self) -> BaseRetentionRequest<'_> {
        BaseRetentionRequest {
            selected: &self.selected,
            working_config: &self.config,
            head: self.head.as_ref(),
            install_scripts: false,
        }
    }

    fn output(&self) -> (Vec<Warning>, Vec<PathBuf>) {
        (
            self.provider.warnings.lock().unwrap().clone(),
            self.cache.lock().unwrap().clone(),
        )
    }
}

fn base() -> Arc<KeptBase> {
    Arc::new(KeptBase {
        generation: Arc::new(Unimock::new(())),
        failures: Arc::new(Unimock::new(())),
        scripts_off: true,
        freshness: None,
    })
}

fn diagnostic() -> Warning {
    let mut record = warning("startup warning");
    record.code = "base-dependencies";
    record
}

#[test]
fn retained_diagnostics_wait_for_freshness_acceptance_and_publish_once() {
    let base = base();
    let accepted = base.clone();
    let inner = Unimock::new(
        BaseProviderMock::find_kept
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                Ok(Some(BaseReuse {
                    base: accepted.clone(),
                    cancellation: Arc::new(Unimock::new(())),
                    releaser: Arc::new(Unimock::new(())),
                }))
            }))
            .n_times(2),
    );
    let fixture = Fixture::new(Ok(PreparedOutcome::Retained), Arc::new(inner.clone()));
    let taken = fixture.provider.take_prepared(&fixture.request()).unwrap();
    let before = fixture.output();
    let found = fixture
        .provider
        .find_kept(&fixture.request())
        .unwrap()
        .unwrap();
    let after = fixture.output();
    let replay = fixture.provider.take_prepared(&fixture.request()).unwrap();
    let found_again = fixture
        .provider
        .find_kept(&fixture.request())
        .unwrap()
        .unwrap();
    assert!(matches!(taken, Some(PreparedOutcome::Retained)));
    assert_eq!(before, (Vec::new(), Vec::new()));
    assert!(Arc::ptr_eq(&found.base, &base));
    assert!(Arc::ptr_eq(&found_again.base, &base));
    assert_eq!(
        after,
        (vec![diagnostic()], vec![PathBuf::from("/startup-cache")])
    );
    assert_eq!(fixture.output(), after);
    assert!(replay.is_none());
}

#[test]
fn retained_diagnostics_drop_on_freshness_miss_error_and_cancellation() {
    let replies: [Result<Option<BaseReuse>>; 3] = [
        Ok(None),
        Err(Error::UnsupportedManager),
        Err(Error::Cancelled),
    ];
    let mut outputs = Vec::new();
    let mut returned = Vec::new();
    for reply in replies {
        let next = base();
        let inner = Unimock::new((
            BaseProviderMock::find_kept
                .next_call(matching!(_))
                .returns(reply),
            BaseProviderMock::find_kept
                .next_call(matching!(_))
                .returns(Ok(Some(BaseReuse {
                    base: next.clone(),
                    cancellation: Arc::new(Unimock::new(())),
                    releaser: Arc::new(Unimock::new(())),
                }))),
        ));
        let fixture = Fixture::new(Ok(PreparedOutcome::Retained), Arc::new(inner.clone()));
        let taken = fixture.provider.take_prepared(&fixture.request()).unwrap();
        let result = fixture.provider.find_kept(&fixture.request());
        assert!(matches!(taken, Some(PreparedOutcome::Retained)));
        returned.push(match result {
            Ok(None) => "miss",
            Err(Error::UnsupportedManager) => "error",
            Err(Error::Cancelled) => "cancelled",
            _ => "unexpected",
        });
        let later = fixture
            .provider
            .find_kept(&fixture.request())
            .unwrap()
            .unwrap();
        assert!(Arc::ptr_eq(&later.base, &next));
        outputs.push(fixture.output());
    }
    assert_eq!(returned, ["miss", "error", "cancelled"]);
    assert_eq!(
        outputs,
        [
            (Vec::new(), Vec::new()),
            (Vec::new(), Vec::new()),
            (Vec::new(), Vec::new())
        ]
    );
}

#[test]
fn captured_handoff_reports_once_and_moves_its_lifetime_to_the_reader() {
    let captured = base();
    let fixture = Fixture::new(
        Ok(PreparedOutcome::Captured(captured.clone())),
        Arc::new(Unimock::new(())),
    );
    let taken = fixture.provider.take_prepared(&fixture.request()).unwrap();
    let replay = fixture.provider.take_prepared(&fixture.request()).unwrap();
    fixture.startup.cancel();
    let after_startup = fixture.lifetime.requested();
    fixture.caller.cancel();
    let after_caller = fixture.lifetime.requested();
    assert!(
        matches!(taken, Some(PreparedOutcome::Captured(base)) if Arc::ptr_eq(&base, &captured))
    );
    assert!(replay.is_none());
    assert_eq!(
        fixture.output(),
        (vec![diagnostic()], vec![PathBuf::from("/startup-cache")])
    );
    assert_eq!((after_startup, after_caller), (false, true));
}

#[test]
fn typed_error_handoff_keeps_accepted_diagnostics_and_error_once() {
    let fixture = Fixture::new(
        Err(Error::Base {
            commit: "a".repeat(40),
            scripts_off: true,
            source: Box::new(Error::UnsupportedManager),
        }),
        Arc::new(Unimock::new(())),
    );
    let taken = fixture.provider.take_prepared(&fixture.request());
    let replay = fixture.provider.take_prepared(&fixture.request()).unwrap();
    assert!(
        matches!(taken, Err(Error::Base { commit, scripts_off: true, source })
        if commit == "a".repeat(40) && matches!(*source, Error::UnsupportedManager))
    );
    assert!(replay.is_none());
    assert_eq!(
        fixture.output(),
        (vec![diagnostic()], vec![PathBuf::from("/startup-cache")])
    );
}
