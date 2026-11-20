//! Schema-only types for comment and approval operations that currently return 503.

#![expect(
    dead_code,
    reason = "Comment and approval handlers are deferred and currently return 503."
)]

pub(crate) mod anchor;
pub(crate) mod approval_input;
pub(crate) mod approvals;
pub(crate) mod audit;
pub(crate) mod comment_input;
pub(crate) mod comments;
pub(crate) mod sync;
