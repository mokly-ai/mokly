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
use crate::wire::Request;

impl Pool {
    pub(super) fn seed_compilation(&self, slot: &mut Slot, params: &Bundle) -> Result<()> {
        let (stored, candidate) = {
            let mut state = self.lock();
            let stored = state.recipes.seed(params);
            let candidate = state
                .bundles
                .iter()
                .filter(|(_, retained)| same_settings(retained, params))
                .max_by_key(|(id, _)| (state.epochs[*id], *id))
                .map(|(id, _)| {
                    (
                        id.clone(),
                        Preparation::snapshot(&state, slot, id, false, false, false),
                    )
                });
            (stored, candidate)
        };
        if let Some(recipe) = stored {
            let generation = recipe.generation.clone();
            self.prerequisite(slot, Call::RestoreGeneration(recipe))?;
            slot.generations.insert(generation, 0);
        }
        if let Some((generation, preparation)) = candidate {
            self.restore(slot, &generation, false, preparation)?;
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
        let preparation = {
            let state = self.lock();
            Preparation::snapshot(
                &state,
                slot,
                generation,
                maps_needed,
                description_needed,
                bindings_needed,
            )
        };
        self.restore(slot, generation, description_needed, preparation)
    }

    fn restore(
        &self,
        slot: &mut Slot,
        generation: &str,
        description_needed: bool,
        preparation: Preparation,
    ) -> Result<()> {
        let Preparation {
            recipe,
            maps,
            bindings,
            epoch,
        } = preparation;
        if let Some(recipe) = recipe {
            self.prerequisite(
                slot,
                Call::RestoreGeneration(Box::new(RestoreGeneration {
                    generation: generation.into(),
                    params: recipe.params,
                    modules: recipe.modules,
                    compiled: (*recipe.compiled).clone(),
                })),
            )?;
            slot.generations.insert(generation.into(), epoch);
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

    fn prerequisite(&self, slot: &mut Slot, call: Call) -> Result<()> {
        if self.lock().stopped {
            return Err(Error::Cancelled);
        }
        let deadline = self.options.timeout_ms.unwrap_or_else(|| call.timeout_ms());
        slot.worker.request(&Request { id: 1, call }, deadline)?;
        Ok(())
    }
}

struct Preparation {
    recipe: Option<Recipe>,
    maps: Option<CssModules>,
    bindings: Option<Arc<Bindings>>,
    epoch: u64,
}

struct Recipe {
    params: Bundle,
    compiled: Arc<CompiledGeneration>,
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
        let bindings = (description_needed && bindings_needed)
            .then(|| &state.bindings[generation])
            .filter(|bindings| {
                !slot
                    .bindings
                    .get(generation)
                    .is_some_and(|loaded| Arc::ptr_eq(loaded, bindings))
            })
            .cloned();
        Self {
            recipe: generation_needed.then(|| Recipe {
                params: state.bundles[generation].clone(),
                compiled: state.compiled[generation].clone(),
                modules: state.modules[generation].clone(),
            }),
            maps: (maps_needed && !slot.maps.contains(generation))
                .then(|| state.maps[generation].clone()),
            bindings,
            epoch: state.epochs[generation],
        }
    }
}

#[cfg(test)]
#[path = "_tests_/pool_preparation_tests.rs"]
mod pool_preparation_tests;
