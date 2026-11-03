//! Receiver decoding keeps supplied optional fields distinct from absent fields.

mod access;
pub(crate) mod nullable;
pub(crate) mod value;
mod visitor;
