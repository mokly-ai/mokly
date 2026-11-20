//! Injected query failures retain their source and call-site context.

use std::io;
use std::iter;

use internal_error::InternalError;
use mkc_store_interface::error;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::error::Error;
use crate::runtime::RuntimeMock;

use super::support::now;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum Site {
    RateLimit,
    InsertRateLimit,
    SaveRateLimit,
    InsertLink,
    Link,
    FindUser,
    InsertUser,
    SaveLink,
    DeleteSession,
    InsertSession,
    Session,
    User,
}

pub(super) fn fail(site: Site, target: Site) -> error::Result<()> {
    if site == target {
        Err(failure())
    } else {
        Ok(())
    }
}

pub(super) fn failure() -> error::Error {
    error::Error::internal(io::Error::from(io::ErrorKind::ConnectionReset))
}

pub(super) fn runtime() -> Unimock {
    Unimock::new((
        RuntimeMock::now.each_call(matching!()).returns(now()),
        RuntimeMock::id
            .each_call(matching!())
            .returns(Uuid::from_u128(8)),
        RuntimeMock::secret
            .each_call(matching!())
            .answers(&|_| Ok("a".repeat(64))),
    ))
    .no_verify_in_drop()
}

pub(super) fn assert_internal(error: Error, context: &str) {
    let Error::Internal(internal) = error else {
        panic!("query failure was reclassified: {error:?}");
    };
    assert!(internal.source_chain().any(|cause| {
        cause
            .downcast_ref::<io::Error>()
            .is_some_and(|error| error.kind() == io::ErrorKind::ConnectionReset)
    }));
    let contexts: Vec<_> = iter::once(&internal)
        .chain(
            internal
                .source_chain()
                .filter_map(|cause| cause.downcast_ref::<InternalError>()),
        )
        .flat_map(InternalError::context_frames)
        .collect();
    assert!(
        contexts.iter().any(|frame| frame.message() == context),
        "{contexts:?}"
    );
}
