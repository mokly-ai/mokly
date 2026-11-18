//! Current outcomes transfer once and stale outcomes get exactly one fresh preparation.

use crate::error::Error;

use super::support::{Outcome, classify};

#[test]
fn current_unretained_results_and_errors_finish_once_without_another_preparation() {
    for outcome in [
        Outcome::Prepared,
        Outcome::PreparationFailure,
        Outcome::CaptureFailure,
    ] {
        let (result, events) = classify(outcome, false);
        let expected = match outcome {
            Outcome::Prepared => vec![
                "prepare",
                "capture-check",
                "capture",
                "complete-check",
                "keep",
                "compare",
            ],
            Outcome::PreparationFailure => vec!["prepare", "complete-check"],
            Outcome::CaptureFailure => {
                vec!["prepare", "capture-check", "capture", "complete-check"]
            }
        };
        assert_eq!(events, expected, "{outcome:?}");
        let correct = match (outcome, result) {
            (Outcome::Prepared, Err(Error::UnsupportedManager)) => true,
            (
                Outcome::PreparationFailure,
                Err(Error::Base {
                    scripts_off: true,
                    source,
                    ..
                }),
            ) => {
                matches!(*source, Error::UnsupportedVersion)
            }
            (
                Outcome::CaptureFailure,
                Err(Error::Base {
                    scripts_off: true,
                    source,
                    ..
                }),
            ) => {
                matches!(*source, Error::YarnPnp)
            }
            _ => false,
        };
        assert!(correct, "{outcome:?}");
    }
}

#[test]
fn stale_prepared_bases_and_errors_get_one_fresh_preparation_before_capture() {
    for outcome in [Outcome::Prepared, Outcome::PreparationFailure] {
        let (result, events) = classify(outcome, true);
        let expected = match outcome {
            Outcome::Prepared => vec![
                "prepare",
                "capture-check",
                "complete-check",
                "restart",
                "prepare",
                "capture-check",
                "capture",
                "complete-check",
                "keep",
                "compare",
            ],
            Outcome::PreparationFailure => vec![
                "prepare",
                "complete-check",
                "restart",
                "prepare",
                "complete-check",
            ],
            Outcome::CaptureFailure => unreachable!(),
        };
        assert_eq!(events, expected, "{outcome:?}");
        let correct = match (outcome, result) {
            (Outcome::Prepared, Err(Error::UnsupportedManager)) => true,
            (
                Outcome::PreparationFailure,
                Err(Error::Base {
                    scripts_off: true,
                    source,
                    ..
                }),
            ) => {
                matches!(*source, Error::UnsupportedVersion)
            }
            _ => false,
        };
        assert!(correct, "{outcome:?}");
    }
}
