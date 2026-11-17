//! Optional bundle seeding and served-recipe offers outside pool IO locks.

use std::sync::Arc;

use crate::bundle_outcomes::CacheOutcome;
use crate::bundle_store::ReadOutcome;
use crate::durable_recipe::DurableRecipe;
use crate::error::{Error, Result};
use crate::methods::{Bundle, Call};
use crate::pool::Pool;
use crate::pool_state::Slot;
use crate::results;
use crate::reusable_recipe::{ReusableRecipe, disk_seed_request};

/// Request-local provenance survives only the existing exchange recovery.
pub(super) struct BundleAttempt {
    memory: Vec<String>,
    disk: Option<String>,
    cause: CacheOutcome,
    disk_checked: bool,
}

impl Default for BundleAttempt {
    fn default() -> Self {
        Self {
            memory: Vec::new(),
            disk: None,
            cause: CacheOutcome::Unavailable,
            disk_checked: false,
        }
    }
}

impl Pool {
    pub(super) fn seed_bundle(
        &self,
        slot: &mut Slot,
        params: &Bundle,
        attempt: &mut BundleAttempt,
    ) -> Result<()> {
        attempt.disk = None;
        let (complete, memory) = self.seed_compilation(slot, params)?;
        attempt.memory = memory;
        if complete {
            attempt.cause = CacheOutcome::StampMismatch;
            return Ok(());
        }
        if attempt.disk_checked {
            return Ok(());
        }
        attempt.disk_checked = true;
        let Some(store) = &self.bundle_store else {
            return Ok(());
        };
        let loaded = store.load(params);
        attempt.cause = loaded.effects().cache.unwrap_or(CacheOutcome::NoRecord);
        let ReadOutcome::Hit { recipe, token, .. } = loaded else {
            return Ok(());
        };
        let request = disk_seed_request(&recipe);
        let Call::RestoreGeneration(restore) = &request.call else {
            return Ok(());
        };
        let generation = restore.generation.clone();
        if self.lock().stopped {
            return Err(Error::Cancelled);
        }
        let restored = slot.worker.request(
            &request,
            self.options
                .timeout_ms
                .unwrap_or_else(|| request.call.timeout_ms()),
        );
        match restored {
            Ok(_) => {
                slot.generations.insert(generation, 0);
                attempt.disk = Some(recipe.compiled().runtime_key.clone());
                attempt.cause = CacheOutcome::StampMismatch;
                Ok(())
            }
            Err(Error::Cancelled) => Err(Error::Cancelled),
            Err(error) => {
                let retirement = store.invalidate(params, &token);
                attempt.cause = retirement.effects().cache.unwrap_or(CacheOutcome::Damaged);
                if matches!(error, Error::Remote { code, .. } if code.reusable()) {
                    Ok(())
                } else {
                    Err(match error {
                        Error::Crashed | Error::Timeout { .. } => error,
                        _ => Error::Crashed,
                    })
                }
            }
        }
    }

    pub(super) fn complete_bundle(
        &self,
        params: &Bundle,
        result: &mut results::Bundle,
        attempt: &BundleAttempt,
    ) {
        let runtime = &result.compiled.runtime_key;
        let reused = if attempt.memory.contains(runtime) {
            Some(CacheOutcome::Memory)
        } else if attempt.disk.as_ref() == Some(runtime) {
            Some(CacheOutcome::Hit)
        } else {
            None
        };
        let mut cause = attempt.cause;
        if let Some(recipe) = ReusableRecipe::new(
            result.generation.clone(),
            params.clone(),
            result.modules.clone(),
            Arc::new(result.compiled.clone()),
        )
        .and_then(DurableRecipe::new)
            && let Some(cache) = self.save_served(&recipe)
        {
            cause = cache;
        }
        result.cache = Some(reused.unwrap_or(cause));
    }

    pub(super) fn save_served(&self, recipe: &DurableRecipe) -> Option<CacheOutcome> {
        let store = self.bundle_store.as_ref()?;
        store.save(recipe).effects().cache
    }

    pub(super) fn served(&self, generation: &str, epoch: u64) {
        let recipe = {
            let state = self.lock();
            if state.stopped
                || !state
                    .leases
                    .get(generation)
                    .is_some_and(|leases| leases.contains(&epoch))
            {
                return;
            }
            ReusableRecipe::new(
                generation.into(),
                state.bundles[generation].clone(),
                state.modules[generation].clone(),
                state.compiled[generation].clone(),
            )
            .and_then(DurableRecipe::new)
        };
        if let Some(recipe) = recipe {
            self.save_served(&recipe);
        }
    }
}

#[cfg(test)]
#[path = "_tests_/bundle_pool/mod.rs"]
mod bundle_pool_tests;
