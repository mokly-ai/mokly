//! Publication Git and network checks observe OS delivery before the listener runs.

use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;

use mokly_git::command;
use mokly_publish::runtime::{self, CommandCancellation};

use crate::cancellation::Cancellation;

/// Combine synchronous signal observation with the asynchronous upload wakeup.
pub struct PublicationSignals {
    /// Shared command signal state.
    pub signals: Arc<dyn Cancellation>,
    /// Wakeup token used by active HTTP and retry waits.
    pub token: CommandCancellation,
}
impl command::Cancellation for PublicationSignals {
    fn is_cancelled(&self) -> bool {
        self.signals.drain();
        self.signals.requested()
    }
}
impl runtime::Cancellation for PublicationSignals {
    fn cancelled(&self) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        self.signals.drain();
        Box::pin(self.token.token.cancelled())
    }
}

#[cfg(test)]
#[path = "_tests_/publication_signals_tests.rs"]
mod publication_signals_tests;
