//! Cancellation-safe sandbox ownership from dispatch intent through destruction.

use std::sync::Arc;

use sandbox_interface::{BackendCreateSandboxRequest, ProviderRef, SandboxLifecycle};
use tokio::runtime::Handle;
use tokio::time::{Duration, timeout};

use crate::failure::Failure;

/// Owns an ambiguous create or a known sandbox until explicit destruction.
pub(crate) struct Cleanup {
    lifecycle: Arc<dyn SandboxLifecycle>,
    runtime: Handle,
    request: Option<BackendCreateSandboxRequest>,
    provider: Option<ProviderRef>,
}

impl Cleanup {
    pub(crate) fn new(
        lifecycle: Arc<dyn SandboxLifecycle>,
        runtime: Handle,
        request: BackendCreateSandboxRequest,
    ) -> Self {
        Self {
            lifecycle,
            runtime,
            request: Some(request),
            provider: None,
        }
    }

    pub(crate) fn acquired(&mut self, provider: ProviderRef) {
        self.provider = Some(provider);
        self.request = None;
    }

    pub(crate) fn resolved(&mut self) {
        self.request = None;
    }

    pub(crate) async fn finish(&mut self) -> Result<(), Failure> {
        if let Some(provider) = &self.provider {
            let result = timeout(
                Duration::from_secs(120),
                self.lifecycle.destroy_sandbox(provider.clone()),
            )
            .await;
            self.provider = None;
            if !matches!(result, Ok(Ok(()))) {
                return Err(Failure::Destroy);
            }
        }
        Ok(())
    }
}

impl Drop for Cleanup {
    fn drop(&mut self) {
        let provider = self.provider.take();
        let request = self.request.take();
        if provider.is_none() && request.is_none() {
            return;
        }
        let lifecycle = self.lifecycle.clone();
        self.runtime.spawn(async move {
            let cleanup = async {
                let provider = match provider {
                    Some(provider) => Some(provider),
                    None => match request {
                        Some(request) => match lifecycle.recover_sandbox_create(request).await {
                            Ok(Some(sandbox)) => Some(sandbox.provider_ref),
                            _ => None,
                        },
                        None => None,
                    },
                };
                if let Some(provider) = provider {
                    let _ = lifecycle.destroy_sandbox(provider).await;
                }
            };
            let _ = timeout(Duration::from_secs(120), cleanup).await;
        });
    }
}
