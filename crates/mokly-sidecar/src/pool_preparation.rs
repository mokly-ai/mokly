//! Reload prerequisites independently of the requested render's deadline.

use std::sync::Arc;

use crate::bindings::Bindings;
use crate::compiled::{CompiledGeneration, RestoreGeneration};
use crate::error::{Error, Result};
use crate::methods::{Bundle, BundleRequest, Call, CssModules, Generation};
use crate::pool::Pool;
use crate::pool_recipes::same_settings;
use crate::pool_state::{Slot, State};
use crate::results::Module;
use crate::reusable_recipe::ReusableRecipe;
use crate::wire::Request;

/// Inputs that must already be installed before a generation call runs.
pub(super) struct Prerequisites {
    /// The call needs the retained CSS class maps.
    pub(super) maps: bool,
    /// The call needs evaluated registrations.
    pub(super) description: bool,
    /// The call needs the latest shared binding payload.
    pub(super) bindings: bool,
}

impl Prerequisites {
    /// Match the inputs that replay installs before the requested call.
    pub(super) fn for_call(call: &Call) -> Self {
        let bindings = matches!(
            call,
            Call::RenderScreen(_)
                | Call::RenderComponent(_)
                | Call::RenderStory(_)
                | Call::RenderPage(_)
        );
        Self {
            maps: !matches!(call, Call::CssModules(_)),
            description: bindings || matches!(call, Call::Bindings(_)),
            bindings,
        }
    }

    /// Missing retained inputs never count as installed on a slot.
    pub(super) fn loaded(&self, state: &State, slot: &Slot, generation: &str) -> bool {
        (!self.maps || (state.maps.contains_key(generation) && slot.maps.contains(generation)))
            && (!self.description || slot.described.contains(generation))
            && (!self.bindings
                || state
                    .bindings
                    .get(generation)
                    .zip(slot.bindings.get(generation))
                    .is_some_and(|(retained, loaded)| Arc::ptr_eq(retained, loaded)))
    }
}

impl Pool {
    pub(super) fn seed_compilation(
        &self,
        slot: &mut Slot,
        request: &BundleRequest,
    ) -> Result<(bool, Vec<String>)> {
        let params = &request.params;
        let capture = request.capture.unwrap_or_default();
        let (stored, mut candidate, fallback, mut keys) = {
            let mut state = self.lock();
            let keys: Vec<_> = slot
                .generations
                .keys()
                .filter_map(|id| state.compiled.get(id))
                .map(|compiled| compiled.runtime_key.clone())
                .collect();
            let stored = state.recipes.seed(params, capture);
            let candidates = state
                .bundles
                .iter()
                .filter(|(_, retained)| same_settings(retained, params))
                .filter_map(|(id, retained)| {
                    ReusableRecipe::new(
                        id.clone(),
                        retained.clone(),
                        state.modules[id].clone(),
                        state.compiled[id].clone(),
                    )
                    .filter(|recipe| recipe.compiled().reuse_evidence.reusable(capture))
                    .map(|recipe| (id, recipe))
                });
            let candidate = candidates
                .clone()
                .max_by_key(|(id, recipe)| {
                    (
                        recipe.compiled().reuse_evidence.captured(),
                        state.epochs[*id],
                        *id,
                    )
                })
                .map(|(id, recipe)| {
                    (
                        id.clone(),
                        recipe.compiled().runtime_key.clone(),
                        Preparation::snapshot(&state, slot, id, false, false, false),
                        recipe.compiled().reuse_evidence.captured(),
                    )
                });
            let fallback = candidate
                .as_ref()
                .filter(|(_, _, _, captured)| *captured)
                .and_then(|_| {
                    candidates
                        .filter(|(_, recipe)| recipe.compiled().reuse_evidence.serve_edit())
                        .max_by_key(|(id, _)| (state.epochs[*id], *id))
                        .map(|(id, recipe)| {
                            (
                                id.clone(),
                                recipe.compiled().runtime_key.clone(),
                                Preparation::snapshot(&state, slot, id, false, false, false),
                            )
                        })
                });
            (stored, candidate, fallback, keys)
        };
        let complete = stored.is_some() || candidate.is_some();
        if stored
            .as_ref()
            .is_some_and(|recipe| !recipe.compiled.reuse_evidence.captured())
            && candidate
                .as_ref()
                .is_some_and(|(_, _, _, captured)| *captured)
            && let Some((generation, runtime, preparation, _)) = candidate.take()
        {
            self.restore(slot, &generation, false, preparation)?;
            keys.push(runtime);
        }
        if let Some(recipe) = stored {
            keys.push(recipe.compiled.runtime_key.clone());
            let generation = recipe.generation.clone();
            self.prerequisite(slot, Call::RestoreGeneration(recipe))?;
            slot.generations.insert(generation, 0);
        }
        if let Some((generation, runtime, preparation, _)) = candidate {
            self.restore(slot, &generation, false, preparation)?;
            keys.push(runtime);
        }
        if let Some((generation, runtime, preparation)) = fallback {
            self.restore(slot, &generation, false, preparation)?;
            keys.push(runtime);
        }
        Ok((complete, keys))
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
                    compiled: recipe.compiled,
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
