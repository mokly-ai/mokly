//! Optional bundle seeding and served-recipe offers outside pool IO locks.

use std::sync::Arc;

use crate::bundle_outcomes::CacheOutcome;
use crate::bundle_store::ReadOutcome;
use crate::compiled::{CompiledGeneration, RestoreGeneration};
use crate::durable_recipe::DurableRecipe;
use crate::error::{Error, Result};
use crate::methods::{BundleCapture, BundleRequest, Call};
use crate::pool::Pool;
use crate::pool_preparation::Preparation;
use crate::pool_state::{Slot, State};
use crate::results;
use crate::reusable_recipe::{ReusableRecipe, disk_seed_request};

/// Request-local provenance survives only the existing exchange recovery.
pub(super) struct BundleAttempt {
    disk: Option<DiskCompilation>,
    cause: CacheOutcome,
    disk_checked: bool,
    retained: Vec<(Arc<CompiledGeneration>, Arc<Vec<results::Module>>)>,
}

struct DiskCompilation {
    recipe: Box<DurableRecipe>,
}

impl Default for BundleAttempt {
    fn default() -> Self {
        Self {
            disk: None,
            cause: CacheOutcome::Unavailable,
            disk_checked: false,
            retained: Vec::new(),
        }
    }
}

impl BundleAttempt {
    pub(super) fn pin_loaded(&mut self, state: &State, slot: &Slot) {
        self.retained.clear();
        for (id, epoch) in &slot.generations {
            if state.epochs.get(id) == Some(epoch) {
                self.pin(&state.compiled[id], &state.modules[id]);
            }
        }
    }

    pub(super) fn pin(
        &mut self,
        compiled: &Arc<CompiledGeneration>,
        modules: &Arc<Vec<results::Module>>,
    ) {
        self.retained.push((compiled.clone(), modules.clone()));
    }
}

impl Pool {
    /// Pin a released seed for the attempt, then restore it in the slot.
    ///
    /// A short reply can name any seed, so the attempt owns its storage until the request ends.
    pub(super) fn install_released(
        &self,
        slot: &mut Slot,
        attempt: &mut BundleAttempt,
        recipe: Box<RestoreGeneration>,
    ) -> Result<()> {
        attempt.pin(&recipe.compiled, &recipe.modules);
        let generation = recipe.generation.clone();
        self.prerequisite(slot, Call::RestoreGeneration(recipe), false)?;
        slot.generations.insert(generation, 0);
        Ok(())
    }

    /// Pin a live seed for the attempt, then send the inputs that the slot lacks.
    pub(super) fn install_live(
        &self,
        slot: &mut Slot,
        attempt: &mut BundleAttempt,
        generation: &str,
        preparation: Preparation,
    ) -> Result<()> {
        preparation.pin(attempt);
        self.restore(slot, generation, false, preparation, false)
    }

    pub(super) fn seed_bundle(
        &self,
        slot: &mut Slot,
        request: &BundleRequest,
        attempt: &mut BundleAttempt,
    ) -> Result<()> {
        attempt.disk = None;
        if self.seed_compilation(slot, request, attempt)? {
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
        let params = &request.params;
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
        let restored = slot.worker.request(&request, self.deadline(&request.call));
        match restored {
            Ok(_) => {
                slot.generations.insert(generation, 0);
                attempt.disk = Some(DiskCompilation { recipe });
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
        request: &BundleRequest,
        result: &mut results::Bundle,
        attempt: &BundleAttempt,
    ) {
        let runtime = &result.compiled.runtime_key;
        let reused = (result.compile_count == 0).then(|| {
            if attempt
                .disk
                .as_ref()
                .is_some_and(|disk| &disk.recipe.compiled().runtime_key == runtime)
            {
                CacheOutcome::Hit
            } else {
                CacheOutcome::Memory
            }
        });
        if let Some(disk) = &attempt.disk
            && &disk.recipe.compiled().runtime_key == runtime
        {
            result.plan = disk.recipe.plan().cloned();
        }
        let mut cause = attempt.cause;
        if request.capture.unwrap_or_default() == BundleCapture::Full
            && let Some(recipe) = ReusableRecipe::new(
                result.generation.clone(),
                request.params.clone(),
                result.modules.clone(),
                result.compiled.clone(),
            )
            .and_then(DurableRecipe::new)
            .map(|recipe| recipe.with_plan(result.plan.clone()))
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
