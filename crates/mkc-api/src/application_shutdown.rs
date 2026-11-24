//! Process signals that initiate graceful API shutdown.

use tokio::signal::ctrl_c;
#[cfg(unix)]
use tokio::signal::unix::{SignalKind, signal};

pub(crate) async fn shutdown_signal() {
    if let Err(error) = wait().await {
        tracing::error!(?error, "shutdown signal failed");
    }
}

#[cfg(unix)]
async fn wait() -> std::io::Result<()> {
    let mut terminate = match signal(SignalKind::terminate()) {
        Ok(terminate) => terminate,
        Err(error) => {
            tracing::error!(?error, "SIGTERM registration failed");
            return ctrl_c().await;
        }
    };
    tokio::select! {
        result = ctrl_c() => result,
        _ = terminate.recv() => Ok(()),
    }
}

#[cfg(not(unix))]
async fn wait() -> std::io::Result<()> {
    ctrl_c().await
}
