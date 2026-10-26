//! A fake Mokly Cloud receiver for the upload exchange v1: Plan, Blob, and Complete.

mod exchange;
mod routes;

pub use exchange::{CompletionCheck, Exchange, Hold, Options, Record, Replan};
