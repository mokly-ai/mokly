//! Serve retains one captured base and checks it before each new reader.

use std::sync::{Arc, Mutex, Weak};

use mokly_compare::base_freshness::{Freshness, FreshnessRequest};
use mokly_compare::base_render::{
    BasePreparationResult, BaseProvider, BaseRequest, PreparationCheckpoint,
};
use mokly_compare::base_retention::{BaseRelease, BaseRetentionRequest, BaseReuse, KeptBase};
use mokly_compare::error::{Error, Result};
use mokly_git::control::Cancellation;
use mokly_render::runtime::Runtime;
use mokly_server::changes::{ChangeCancellation, ChangeCommit};

use crate::serve_base_cancel::BaseLifetime;
use crate::serve_base_key::BaseKey;
use crate::serve_preparation_control::PreparationControl;

/// One adopted key and its complete captured base.
pub(super) struct KeptEntry {
    key: BaseKey,
    base: Arc<KeptBase>,
}

/// The one optional base owned by Serve state.
pub(super) type BaseSlot = Mutex<Option<KeptEntry>>;

/// Classification-local retention policy with a weak link to Serve state.
pub(super) struct ServeBase {
    pub(super) preparation: Option<Arc<dyn PreparationControl>>,
    /// Only Serve state owns the slot across calls.
    pub(super) slot: Weak<BaseSlot>,
    /// Normal source preparation with its existing warning and progress boundaries.
    pub(super) inner: Arc<dyn BaseProvider>,
    /// Current evidence checks run outside the slot lock.
    pub(super) freshness: Arc<dyn Freshness>,
    /// Current dependency use governs sidecar evidence checks.
    pub(super) runtime: Arc<Runtime>,
    /// Each reader keeps this classification and capture cancellation.
    pub(super) reader: Arc<dyn Cancellation>,
    /// The keep commits only while this preparing classification is current.
    pub(super) origin: Arc<dyn ChangeCancellation>,
    /// Prepared base services detach only after an eligible keep commits.
    pub(super) lifetime: Arc<dyn BaseLifetime>,
}

impl BaseProvider for ServeBase {
    fn checkpoint(
        &self,
        request: &BaseRetentionRequest<'_>,
        checkpoint: PreparationCheckpoint,
    ) -> Result<bool> {
        match &self.preparation {
            Some(preparation) => preparation.checkpoint(request, checkpoint),
            None => Ok(true),
        }
    }
    fn restarting(&self) {
        self.inner.restarting();
        if let Some(preparation) = &self.preparation {
            preparation.restarting();
        }
    }
    fn find_kept(&self, request: &BaseRetentionRequest<'_>) -> Result<Option<BaseReuse>> {
        if self.reader.cancelled() {
            return Err(Error::Cancelled);
        }
        let key = BaseKey::new(request)?;
        let base = {
            let Some(owner) = self.slot.upgrade() else {
                return Ok(None);
            };
            let mut slot = owner.lock().unwrap_or_else(|error| error.into_inner());
            match slot.as_ref() {
                Some(entry) if entry.key == key => Some(entry.base.clone()),
                _ => {
                    *slot = None;
                    None
                }
            }
        };
        let Some(base) = base else {
            return Ok(None);
        };
        if let Some(preparation) = &self.preparation {
            preparation.wait()?;
        }
        let Some(inputs) = &base.freshness else {
            self.release(&base);
            return Ok(None);
        };
        let (directories, unmapped) = if inputs.selection.paths.is_some() {
            (
                request
                    .head
                    .catalogue()
                    .dependency_directories
                    .iter()
                    .cloned()
                    .collect::<Vec<_>>(),
                Vec::new(),
            )
        } else {
            (
                self.runtime.dependency_usage.directories(),
                self.runtime.dependency_usage.unmapped_directories(),
            )
        };
        let current = self.freshness.current(
            inputs,
            &FreshnessRequest {
                selected: request.selected,
                head: request.head,
                directories: &directories,
                unmapped: &unmapped,
            },
        );
        if self.reader.cancelled() {
            return Err(Error::Cancelled);
        }
        match current {
            Ok(true) => Ok(Some(BaseReuse {
                base,
                cancellation: self.reader.clone(),
                releaser: Arc::new(ReleaseBase {
                    slot: self.slot.clone(),
                }),
            })),
            Err(Error::Cancelled) => Err(Error::Cancelled),
            result => {
                if let Err(error) = result {
                    tracing::debug!(%error, "kept base freshness is unavailable");
                }
                self.release(&base);
                Ok(None)
            }
        }
    }

    fn prepare(&self, request: &BaseRequest<'_>) -> BasePreparationResult {
        self.inner.prepare(request)
    }

    fn keep(
        &self,
        request: &BaseRetentionRequest<'_>,
        base: Arc<KeptBase>,
    ) -> Result<Option<BaseReuse>> {
        let Some(slot) = self.slot.upgrade() else {
            return Ok(None);
        };
        if base
            .freshness
            .as_ref()
            .is_none_or(|inputs| inputs.checkout.filtered)
            || base.failures.failure().is_some()
            || base
                .failures
                .warnings()
                .iter()
                .chain(&base.generation.catalogue().warnings)
                .any(|warning| warning.code == "base-conversion")
        {
            return Ok(None);
        }
        let keep = Keep {
            slot: slot.as_ref(),
            key: BaseKey::new(request)?,
            base: base.clone(),
            lifetime: self.lifetime.as_ref(),
            reader: self.reader.as_ref(),
        };
        if !self.origin.commit(&keep) {
            return Err(Error::Cancelled);
        }
        Ok(Some(BaseReuse {
            base,
            cancellation: self.reader.clone(),
            releaser: Arc::new(ReleaseBase {
                slot: self.slot.clone(),
            }),
        }))
    }

    fn release(&self, base: &Arc<KeptBase>) {
        ReleaseBase {
            slot: self.slot.clone(),
        }
        .release(base);
    }
}

/// A retained reader can release its exact base without owning Serve state.
struct ReleaseBase {
    slot: Weak<BaseSlot>,
}

impl BaseRelease for ReleaseBase {
    fn release(&self, base: &Arc<KeptBase>) {
        let Some(owner) = self.slot.upgrade() else {
            return;
        };
        let mut slot = owner.lock().unwrap_or_else(|error| error.into_inner());
        if slot
            .as_ref()
            .is_some_and(|entry| Arc::ptr_eq(&entry.base, base))
        {
            *slot = None;
        }
    }
}

struct Keep<'a> {
    slot: &'a BaseSlot,
    key: BaseKey,
    base: Arc<KeptBase>,
    lifetime: &'a dyn BaseLifetime,
    reader: &'a dyn Cancellation,
}

impl ChangeCommit for Keep<'_> {
    fn apply(&self) -> bool {
        if self.reader.cancelled() {
            return false;
        }
        let mut slot = self.slot.lock().unwrap_or_else(|error| error.into_inner());
        self.lifetime.detach();
        *slot = Some(KeptEntry {
            key: self.key.clone(),
            base: self.base.clone(),
        });
        true
    }
}

#[cfg(test)]
#[path = "_tests_/serve_base/mod.rs"]
mod serve_base_tests;
