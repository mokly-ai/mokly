//! GitHub mocks distinguish cancellation failure from typed run state.

use std::io;
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::remote::contracts::{GithubCancelMock, GithubRunState, GithubStateMock};
use crate::remote::error::{Error, Operation};

use super::harness_tests::Case;

pub(super) fn github(case: Case, events: Arc<Mutex<Vec<String>>>) -> Arc<Unimock> {
    if case == Case::MissingRun {
        return Arc::new(Unimock::new(()));
    }
    let cancel_events = events.clone();
    let cancel = GithubCancelMock
        .each_call(matching!(_))
        .answers_arc(Arc::new(move |_, id| {
            cancel_events.lock().unwrap().push(format!("cancel:{id}"));
            if matches!(
                case,
                Case::Cancel | Case::CancelCompleted | Case::CancelReadFailure
            ) {
                return Err(Error::Io {
                    operation: Operation::Github,
                    source: io::Error::other("run completed"),
                });
            }
            Ok(())
        }));
    Arc::new(
        if matches!(
            case,
            Case::Cancel | Case::CancelCompleted | Case::CancelReadFailure
        ) {
            Unimock::new((
                cancel,
                GithubStateMock
                    .each_call(matching!(_))
                    .answers_arc(Arc::new(move |_, id| {
                        events.lock().unwrap().push(format!("run-state:{id}"));
                        match case {
                            Case::CancelCompleted => Ok(GithubRunState::Completed),
                            Case::CancelReadFailure => Err(Error::Io {
                                operation: Operation::Github,
                                source: io::Error::other("run completed"),
                            }),
                            _ => Ok(GithubRunState::Other),
                        }
                    })),
            ))
        } else {
            Unimock::new(cancel)
        },
    )
}
