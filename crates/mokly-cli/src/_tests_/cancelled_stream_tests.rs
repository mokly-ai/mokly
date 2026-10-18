//! Cancellation stops the next asset chunk without write_all retrying interruption forever.

use std::io;
use std::path::Path;
use std::sync::Arc;

use mokly_source_interface::error::SourceError;
use mokly_source_interface::stream::{SourceStream, SourceStreamMock};
use unimock::{MockFn, Unimock, matching};

use crate::cancellation::CancellationMock;

use super::CancellableStream;

#[test]
fn cancellation_between_chunks_stops_copying_and_keeps_the_interrupted_error() {
    let cancellation = Unimock::new((
        CancellationMock::requested
            .next_call(matching!())
            .returns(false),
        CancellationMock::requested
            .next_call(matching!())
            .returns(false),
        CancellationMock::requested
            .next_call(matching!())
            .returns(true),
        CancellationMock::requested
            .next_call(matching!())
            .returns(true),
    ));
    let source = Unimock::new(
        SourceStreamMock::copy_verified
            .next_call(matching!(_, "expected", _))
            .answers(&|_, path, _, output| {
                output.write_all(b"first").unwrap();
                let source = output.write_all(b"second").unwrap_err();
                assert_eq!(source.kind(), io::ErrorKind::Other);
                Err(SourceError::Io {
                    operation: "write resource",
                    path: path.into(),
                    source,
                })
            }),
    );
    let mut stream: Box<dyn SourceStream> = Box::new(CancellableStream {
        inner: Box::new(source),
        cancellation: Arc::new(cancellation),
    });
    let mut output = Vec::new();
    assert!(
        matches!(stream.copy_verified(Path::new("asset.svg"), "expected", &mut output), Err(SourceError::Io { source, .. }) if source.kind() == io::ErrorKind::Interrupted)
    );
    assert_eq!(output, b"first");
}
