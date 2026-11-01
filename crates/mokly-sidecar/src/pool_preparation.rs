//! Reload prerequisites independently of the requested render's deadline.

use std::sync::Arc;

use crate::bindings::Bindings;
use crate::compiled::{CompiledGeneration, RestoreGeneration};
use crate::error::{Error, Result};
use crate::methods::{Bundle, Call, CssModules, Generation};
use crate::pool::Pool;
use crate::pool_recipes::same_settings;
use crate::pool_state::{Slot, State};
use crate::results::Module;
use crate::wire::{MethodResult, Request};

impl Pool {
    pub(super) fn seed_compilation(&self, slot: &mut Slot, params: &Bundle) -> Result<()> {
        let (stored, candidate) = {
            let mut state = self.lock()?;
            let stored = state.recipes.seed(params);
            let candidate = state
                .bundles
                .iter()
                .filter(|(id, retained)| {
                    same_settings(retained, params) && state.compiled.contains_key(*id)
                })
                .max_by_key(|(id, _)| (state.epochs.get(*id).copied().unwrap_or(0), *id))
                .map(|(id, _)| id.clone());
            (stored, candidate)
        };
        if let Some(recipe) = stored {
            let generation = recipe.generation.clone();
            self.prerequisite(slot, Call::RestoreGeneration(recipe))?;
            slot.generations.insert(generation, 0);
        }
        if let Some(generation) = candidate {
            self.prepare(slot, &generation, false, false, false)?;
        }
        Ok(())
    }

    pub(super) fn prepare(
        &self,
        slot: &mut Slot,
        generation: &str,
        maps_needed: bool,
        description_needed: bool,
        bindings_needed: bool,
    ) -> Result<()> {
        let Preparation {
            bundle,
            maps,
            bindings,
            epoch,
            compiled,
            modules,
        } = {
            let state = self.lock()?;
            Preparation::snapshot(
                &state,
                slot,
                generation,
                maps_needed,
                description_needed,
                bindings_needed,
            )
        };
        if !slot.generations.contains_key(generation) {
            let Some(bundle) = bundle else {
                return Err(Error::UnknownGeneration {
                    generation: generation.to_owned(),
                });
            };
            let response = if let Some(compiled) = compiled {
                self.prerequisite(
                    slot,
                    Call::RestoreGeneration(Box::new(RestoreGeneration {
                        generation: generation.into(),
                        params: bundle,
                        modules,
                        compiled: (*compiled).clone(),
                    })),
                )?;
                slot.generations.insert(generation.into(), epoch);
                None
            } else {
                Some(self.prerequisite(slot, Call::Bundle(bundle))?)
            };
            if let Some(response) = response {
                if let MethodResult::Bundle(value) = response {
                    if value.generation != generation {
                        self.prerequisite(
                            slot,
                            Call::Dispose(Generation {
                                generation: value.generation,
                            }),
                        )?;
                        return Err(Error::GenerationChanged {
                            generation: generation.to_owned(),
                        });
                    }
                    slot.generations.insert(generation.to_owned(), epoch);
                } else {
                    return Err(Error::GenerationChanged {
                        generation: generation.to_owned(),
                    });
                }
            }
        }
        if let Some(maps) = maps {
            self.prerequisite(slot, Call::CssModules(maps))?;
            slot.maps.insert(generation.to_owned());
        }
        if description_needed && !slot.described.contains(generation) {
            self.prerequisite(
                slot,
                Call::Describe(Generation {
                    generation: generation.to_owned(),
                }),
            )?;
            slot.described.insert(generation.to_owned());
        }
        if let Some(bindings) = bindings {
            self.prerequisite(slot, Call::Bindings((*bindings).clone()))?;
            slot.bindings.insert(generation.to_owned(), bindings);
        }
        Ok(())
    }

    fn prerequisite(&self, slot: &mut Slot, call: Call) -> Result<MethodResult> {
        if self.lock()?.stopped {
            return Err(Error::Cancelled);
        }
        let deadline = self.options.timeout_ms.unwrap_or_else(|| call.timeout_ms());
        slot.worker.request(&Request { id: 1, call }, deadline)
    }
}

struct Preparation {
    bundle: Option<Bundle>,
    maps: Option<CssModules>,
    bindings: Option<Arc<Bindings>>,
    epoch: u64,
    compiled: Option<Arc<CompiledGeneration>>,
    modules: Vec<Module>,
}

impl Preparation {
    fn snapshot(
        state: &State,
        slot: &Slot,
        generation: &str,
        maps_needed: bool,
        description_needed: bool,
        bindings_needed: bool,
    ) -> Self {
        let generation_needed = !slot.generations.contains_key(generation);
        let bindings = if description_needed && bindings_needed {
            state
                .bindings
                .get(generation)
                .filter(|bindings| {
                    !slot
                        .bindings
                        .get(generation)
                        .is_some_and(|loaded| Arc::ptr_eq(loaded, bindings))
                })
                .cloned()
        } else {
            None
        };
        Self {
            bundle: generation_needed
                .then(|| state.bundles.get(generation).cloned())
                .flatten(),
            maps: (maps_needed && !slot.maps.contains(generation))
                .then(|| state.maps.get(generation).cloned())
                .flatten(),
            bindings,
            epoch: state.epochs.get(generation).copied().unwrap_or(0),
            compiled: generation_needed
                .then(|| state.compiled.get(generation).cloned())
                .flatten(),
            modules: if generation_needed {
                state.modules.get(generation).cloned().unwrap_or_default()
            } else {
                Vec::new()
            },
        }
    }
}

#[cfg(test)]
#[path = "_tests_/pool_preparation_tests.rs"]
mod pool_preparation_tests;
