//! The changed-file source and protocol length audit and the protocol
//! document cap ratchet, with their shared length policy and Git comparison.

mod caps;
pub(crate) mod error;
mod git;
mod policy;
pub(crate) mod protocol_audit;
mod protocol_caps;
pub(crate) mod source_audit;
