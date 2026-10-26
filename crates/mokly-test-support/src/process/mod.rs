//! Run the `mokly` binary with captured output, signals, and its reported build directory.

mod command;
mod running;
mod signals;

pub use command::{Invocation, Mokly, PUBLISH_BUILD};
pub use running::{BuildDirectory, ChildId, Finished, Running};
pub use signals::{alive, signal, signal_group};
