//! Persistent signal handlers turn repeated console signals into one stop request.

use std::io;

use tokio::sync::watch;
use tokio::task::JoinHandle;

pub(super) fn install(stop: watch::Sender<bool>) -> io::Result<JoinHandle<()>> {
    #[cfg(unix)]
    {
        let mut interrupt =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::interrupt())?;
        let mut terminate =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())?;
        Ok(tokio::spawn(async move {
            loop {
                tokio::select! { _ = interrupt.recv() => {}, _ = terminate.recv() => {} }
                stop.send_replace(true);
            }
        }))
    }
    #[cfg(not(unix))]
    {
        Ok(tokio::spawn(async move {
            while tokio::signal::ctrl_c().await.is_ok() {
                stop.send_replace(true);
            }
        }))
    }
}
