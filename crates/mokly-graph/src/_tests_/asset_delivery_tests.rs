//! Asset opens distinguish replaced inputs, IO failures, and explicit cancellation.

use std::io;
use std::path::Path;
use std::sync::{Arc, Mutex};

use mokly_model::runtime_diagnostic::RuntimeCode;
use mokly_source_interface::error::SourceError;
use mokly_source_interface::tree::SourceTreeMock;
use unimock::{MockFn, Unimock, matching};

use crate::error::{GraphError, InternalError};

use super::{open, source};

fn failed_open(error: SourceError) -> GraphError {
    let error = Mutex::new(Some(error));
    let tree = Unimock::new(
        SourceTreeMock::open_stream
            .next_call(matching!((path) if *path == Path::new("/repo/image.svg")))
            .answers_arc(Arc::new(move |_, _| {
                Err(error.lock().unwrap().take().unwrap())
            })),
    );
    open(&tree, Path::new("/repo/image.svg")).err().unwrap()
}

fn io_error(kind: io::ErrorKind) -> SourceError {
    SourceError::Io {
        operation: "open resource stream",
        path: "/repo/image.svg".into(),
        source: kind.into(),
    }
}

#[test]
fn only_vanished_and_replaced_inputs_request_a_new_generation() {
    for error in [
        io_error(io::ErrorKind::NotFound),
        io_error(io::ErrorKind::NotADirectory),
        SourceError::Changed {
            path: "/repo/image.svg".into(),
        },
    ] {
        assert!(
            matches!(failed_open(error), GraphError::InputsChanged { path }
            if path == Path::new("/repo/image.svg"))
        );
    }
}

#[test]
fn unrelated_open_errors_retain_the_operation_path_and_io_cause() {
    for kind in [
        io::ErrorKind::PermissionDenied,
        io::ErrorKind::InvalidInput,
        io::ErrorKind::Interrupted,
        io::ErrorKind::Other,
        io::ErrorKind::TooManyLinks,
    ] {
        let GraphError::Internal(InternalError::Provider { source }) = failed_open(io_error(kind))
        else {
            panic!("IO failure became a changed input or cancellation")
        };
        let SourceError::Io {
            operation,
            path,
            source,
        } = source.downcast_ref::<SourceError>().unwrap()
        else {
            panic!("original IO error was lost")
        };
        assert_eq!(*operation, "open resource stream");
        assert_eq!(path, Path::new("/repo/image.svg"));
        assert_eq!(source.kind(), kind);
    }
}

#[test]
fn explicit_cancellation_survives_open_and_copy_boundaries() {
    let cancelled = || SourceError::Cancelled {
        path: "/repo/image.svg".into(),
    };
    for error in [
        failed_open(cancelled()),
        source::<()>(Err(cancelled())).unwrap_err(),
    ] {
        assert!(matches!(error, GraphError::Runtime { source }
            if source.code == RuntimeCode::Cancelled && source.message == "build cancelled"));
    }
    assert!(matches!(
        source::<()>(Err(io_error(io::ErrorKind::Interrupted))),
        Err(GraphError::Internal(InternalError::Provider { .. }))
    ));
}
