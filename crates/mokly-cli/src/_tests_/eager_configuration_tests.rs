//! Small configured pools keep serial preparation while larger pools own pending work.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_cli::grammar::Cli;
use mokly_cli::options::{Environment, validate};
use mokly_cli::parsing::parse;
use unimock::{MockFn, Unimock, matching};

use crate::warning_support::config;

use super::{EagerAttempts, EagerFactoryMock, EagerStarts, PendingBase, PendingBaseMock};

#[test]
fn configured_small_pools_start_no_pending_base_and_three_starts_one() {
    let starts = Arc::new(AtomicUsize::new(0));
    let started = starts.clone();
    let pending: Arc<dyn PendingBase> = Arc::new(Unimock::new(
        PendingBaseMock::config
            .each_call(matching!())
            .returns(config()),
    ));
    let factory = Arc::new(Unimock::new(
        EagerFactoryMock::start
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                started.fetch_add(1, Ordering::SeqCst);
                pending.clone()
            })),
    ));
    for (arguments, cores, expected) in [
        (vec!["mokly"], 1, (false, 0)),
        (vec!["mokly"], 2, (false, 0)),
        (vec!["mokly", "--sidecars=2"], 8, (false, 0)),
        (vec!["mokly", "--sidecars=3"], 8, (true, 1)),
    ] {
        let mut cli: Cli = parse(
            &arguments
                .iter()
                .map(|argument| (*argument).into())
                .collect::<Vec<_>>(),
        )
        .unwrap();
        validate(
            &mut cli,
            &Environment {
                cores,
                ..Environment::default()
            },
        )
        .unwrap();
        let attempts: &dyn EagerStarts = &EagerAttempts::default();
        attempts.configure(cli.common().sidecars, factory.clone());
        attempts.start(&config());
        let bound = attempts.bind(&config());
        assert_eq!(
            (bound.is_some(), starts.load(Ordering::SeqCst)),
            expected,
            "arguments: {arguments:?}, default cores: {cores}"
        );
    }
}
