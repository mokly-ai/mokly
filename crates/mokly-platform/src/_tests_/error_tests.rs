//! I/O conversion keeps diagnostic context and the original typed error.

use std::io;
use std::panic::Location;
use std::ptr;

use super::{Error, InternalError, IoResult};

#[derive(Debug, thiserror::Error)]
#[error("original I/O failure")]
struct OriginalSource(u8);

#[track_caller]
fn convert(source: io::Error) -> (Error, &'static Location<'static>) {
    (
        Err::<(), _>(source).platform().unwrap_err(),
        Location::caller(),
    )
}

#[test]
fn io_conversion_keeps_the_caller_and_original_source() {
    let source = io::Error::new(io::ErrorKind::PermissionDenied, OriginalSource(17));
    let original_pointer = ptr::from_ref(
        source
            .get_ref()
            .unwrap()
            .downcast_ref::<OriginalSource>()
            .unwrap(),
    );
    let source_debug = format!("{source:?}");
    let (error, caller) = convert(source);

    assert_eq!(
        error.to_string(),
        "[mokly-platform/internal] operating-system operation failed: original I/O failure"
    );
    let Error::Internal(InternalError::Io { source, .. }) = &error else {
        panic!("expected an internal I/O error, got {error:?}");
    };
    assert_eq!(source.kind(), io::ErrorKind::PermissionDenied);
    let retained_original = source
        .get_ref()
        .unwrap()
        .downcast_ref::<OriginalSource>()
        .unwrap();
    assert_eq!(retained_original.0, 17);
    assert!(ptr::eq(retained_original, original_pointer));

    let internal = std::error::Error::source(&error).unwrap();
    let retained_io = std::error::Error::source(internal)
        .unwrap()
        .downcast_ref::<io::Error>()
        .unwrap();
    assert!(ptr::eq(retained_io, source));
    assert_eq!(
        format!("{error:?}"),
        format!("Internal(Io {{ source: {source_debug}, defined_at: {caller:?} }})")
    );
}
