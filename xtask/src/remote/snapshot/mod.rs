//! Exclusive snapshot ownership, Git tree construction and best-effort cleanup.

mod construction;
pub(crate) mod contracts;
pub(crate) mod filesystem;
pub(in crate::remote) mod guard;
mod removal;
pub(crate) mod system;
