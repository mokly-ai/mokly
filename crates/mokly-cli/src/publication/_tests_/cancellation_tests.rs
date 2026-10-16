//! Both pre-build checkout failures observe cancellation after the operation.

use std::sync::Arc;

use mokly_git::command::CancellationMock;
use mokly_publish::checkout::CheckoutMock;
use mokly_publish::error;
use unimock::{MockFn, Unimock, matching};

use crate::publication::command::Publish;
use crate::publication::error::Error;

use super::command_tests::{command, inspection, options};
use super::support::settings;

#[tokio::test]
async fn inspection_and_identity_failures_recheck_cancellation_and_keep_the_cause() {
    for identity in [false, true] {
        for cancelled in [false, true] {
            let mock = if identity {
                Unimock::new((
                    CheckoutMock::inspect
                        .next_call(matching!(_, _, _))
                        .returns(Ok(inspection())),
                    CheckoutMock::publication
                        .next_call(matching!(_, _, _, _, _))
                        .returns(Err(error::Error::Repository)),
                ))
            } else {
                Unimock::new(
                    CheckoutMock::inspect
                        .next_call(matching!(_, _, _))
                        .returns(Err(error::Error::Checkout)),
                )
            };
            let cancellation = if identity {
                Unimock::new((
                    CancellationMock::is_cancelled
                        .next_call(matching!())
                        .returns(false),
                    CancellationMock::is_cancelled
                        .next_call(matching!())
                        .returns(cancelled),
                ))
            } else {
                Unimock::new(
                    CancellationMock::is_cancelled
                        .next_call(matching!())
                        .returns(cancelled),
                )
            };
            let failure = command(Arc::new(mock))
                .run(&options(), &settings(1), &cancellation)
                .await
                .unwrap_err();
            let source = match failure {
                Error::Interrupted { source } if cancelled => source,
                Error::Exchange { source } if !cancelled => source,
                error => panic!("wrong error: {error}"),
            };
            assert!(matches!(
                (identity, source),
                (true, error::Error::Repository) | (false, error::Error::Checkout)
            ));
        }
    }
}

#[tokio::test]
async fn a_signal_after_successful_inspection_stops_before_checkout_policy() {
    let mut dirty = inspection();
    dirty.changed_paths.push("changed.screen.html".into());
    let checkout = Unimock::new(
        CheckoutMock::inspect
            .next_call(matching!(_, _, _))
            .returns(Ok(dirty)),
    );
    let cancellation = Unimock::new(
        CancellationMock::is_cancelled
            .next_call(matching!())
            .returns(true),
    );
    assert!(matches!(
        command(Arc::new(checkout))
            .run(&options(), &settings(1), &cancellation)
            .await,
        Err(Error::Exchange {
            source: error::Error::Cancelled
        })
    ));
}
