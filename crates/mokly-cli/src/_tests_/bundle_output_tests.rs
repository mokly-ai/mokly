//! Optional bundle failures print recoverable terminal warnings without build diagnostics.

use std::sync::{Arc, Mutex};

use mokly_cli::output::Mode;
use mokly_sidecar::bundle_outcomes::EntryFault;
use mokly_sidecar::bundle_store::{
    BundleStore, BundleStoreMock, ReadMiss, ReadOutcome, WriteOutcome,
};
use mokly_sidecar::methods::Bundle;
use mokly_sidecar::workers::DiagnosticsMock;
use unimock::{MockFn, Unimock, matching};

use super::{Reported, Unavailable};

fn params() -> Bundle {
    Bundle {
        vite: false,
        evaluation: None,
        entry_files: vec![],
        renderer: None,
        stories_files: vec![],
        source_root: "/repo".into(),
        configuration_directory: ".".into(),
        repository_roots: vec![],
        module_resolution: Default::default(),
    }
}

#[test]
fn foreign_and_damaged_entries_warn_and_preserve_both_retirement_faults() {
    for fault in [
        EntryFault::VersionMismatch,
        EntryFault::Damaged,
        EntryFault::Unreadable,
    ] {
        let messages = Arc::new(Mutex::new(vec![]));
        let emitted = messages.clone();
        let outcome = ReadOutcome::Rejected {
            fault,
            retirement: WriteOutcome::StoreFault,
        };
        let store = Reported {
            directory: Arc::new(Unimock::new(())),
            inner: Arc::new(Unimock::new(
                BundleStoreMock::load
                    .some_call(matching!(_))
                    .returns(outcome),
            )),
            diagnostics: Arc::new(Unimock::new(
                DiagnosticsMock::emit
                    .each_call(matching!(_))
                    .answers_arc(Arc::new(move |_, message| {
                        emitted.lock().unwrap().push(message.to_owned());
                    })),
            )),
            mode: Mode::Plain,
        };
        assert!(matches!(
            store.load(&params()),
            ReadOutcome::Rejected {
                retirement: WriteOutcome::StoreFault,
                ..
            }
        ));
        assert_eq!(
            *messages.lock().unwrap(),
            [
                "[mokly/warning] A cached JavaScript bundle could not be reused. Bundling it again.",
                "[mokly/warning] The JavaScript bundle cache is unavailable. Bundling without it.",
            ]
        );
    }
}

#[test]
fn unusable_location_warns_once_and_normal_misses_stay_silent() {
    let messages = Arc::new(Mutex::new(vec![]));
    let emitted = messages.clone();
    let store = Reported {
        directory: Arc::new(Unimock::new(())),
        inner: Arc::new(Unavailable(false.into())),
        diagnostics: Arc::new(Unimock::new(
            DiagnosticsMock::emit
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, message| {
                    emitted.lock().unwrap().push(message.to_owned());
                })),
        )),
        mode: Mode::Rich,
    };
    assert!(matches!(
        store.load(&params()),
        ReadOutcome::Miss(ReadMiss::StoreFault)
    ));
    assert!(matches!(
        store.load(&params()),
        ReadOutcome::Miss(ReadMiss::Disabled)
    ));
    assert_eq!(
        *messages.lock().unwrap(),
        ["  ! The JavaScript bundle cache is unavailable. Bundling without it."]
    );
    for reason in [
        ReadMiss::Absent,
        ReadMiss::Contended,
        ReadMiss::Cancelled,
        ReadMiss::Disabled,
    ] {
        let silent = Reported {
            directory: Arc::new(Unimock::new(())),
            inner: Arc::new(Unimock::new(
                BundleStoreMock::load
                    .some_call(matching!(_))
                    .returns(ReadOutcome::Miss(reason)),
            )),
            diagnostics: Arc::new(Unimock::new(())),
            mode: Mode::Plain,
        };
        assert!(matches!(silent.load(&params()), ReadOutcome::Miss(actual) if actual == reason));
    }
}
