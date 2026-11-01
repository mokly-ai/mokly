//! Bounded retention of the last released compilation for each bundle setting.

use std::sync::Arc;

use crate::codec::{self, MAX_FRAME_BYTES};
use crate::compiled::{CompiledGeneration, RestoreGeneration};
use crate::methods::{Bundle, Call};
use crate::results::Module;
use crate::wire::Request;

/// Released recipes charged by their serialized restore envelopes.
pub(super) struct Recipes {
    entries: Vec<Recipe>,
    bound: usize,
    bytes: usize,
    counter: u64,
}

struct Recipe {
    generation: String,
    params: Bundle,
    modules: Vec<Module>,
    compiled: Arc<CompiledGeneration>,
    bytes: usize,
    used: u64,
}

impl Recipe {
    /// Keep a stored seed separate from a live recipe with the same content id.
    fn restore(&self) -> Box<RestoreGeneration> {
        Box::new(RestoreGeneration {
            generation: seed_id(&self.generation),
            params: self.params.clone(),
            modules: self.modules.clone(),
            compiled: (*self.compiled).clone(),
        })
    }
}

impl Recipes {
    /// Construct a store with a serialized byte bound.
    pub(super) fn new(bound: usize) -> Self {
        Self {
            entries: Vec::new(),
            bound,
            bytes: 0,
            counter: 0,
        }
    }

    /// Replace equal settings and evict the least recently used entries to fit.
    pub(super) fn insert(
        &mut self,
        generation: String,
        params: Bundle,
        modules: Vec<Module>,
        compiled: Arc<CompiledGeneration>,
    ) {
        if let Some(index) = self.find(&params) {
            self.remove(index);
        }
        let mut recipe = Recipe {
            generation,
            params,
            modules,
            compiled,
            bytes: 0,
            used: 0,
        };
        let request = Request {
            id: 1,
            call: Call::RestoreGeneration(recipe.restore()),
        };
        let Ok(encoded) = codec::encode(&request) else {
            return;
        };
        recipe.bytes = encoded.len() - 1;
        if recipe.bytes > self.bound {
            return;
        }
        self.counter += 1;
        recipe.used = self.counter;
        self.bytes += recipe.bytes;
        self.entries.push(recipe);
        while self.bytes > self.bound {
            let Some(index) = self
                .entries
                .iter()
                .enumerate()
                .min_by_key(|(_, entry)| entry.used)
                .map(|(index, _)| index)
            else {
                break;
            };
            self.remove(index);
        }
    }

    /// Touch and materialize a retained recipe for a bundle request.
    pub(super) fn seed(&mut self, params: &Bundle) -> Option<Box<RestoreGeneration>> {
        let index = self.find(params)?;
        self.counter += 1;
        self.entries[index].used = self.counter;
        Some(self.entries[index].restore())
    }

    /// Move matching compilation storage into a newly live generation.
    pub(super) fn take_reused(
        &mut self,
        params: &Bundle,
        compiled: &CompiledGeneration,
    ) -> Option<Arc<CompiledGeneration>> {
        let index = self.find(params)?;
        if !self.entries[index].compiled.same_recipe(compiled) {
            return None;
        }
        Some(self.remove(index).compiled)
    }

    /// Discard every retained recipe when the pool stops.
    pub(super) fn clear(&mut self) {
        self.entries.clear();
        self.bytes = 0;
        self.counter = 0;
    }

    fn find(&self, params: &Bundle) -> Option<usize> {
        self.entries
            .iter()
            .position(|entry| same_settings(&entry.params, params))
    }

    fn remove(&mut self, index: usize) -> Recipe {
        let recipe = self.entries.remove(index);
        self.bytes -= recipe.bytes;
        recipe
    }

    /// Count retained recipes for pool lifecycle assertions.
    #[cfg(test)]
    pub(super) fn len(&self) -> usize {
        self.entries.len()
    }
}

impl Default for Recipes {
    fn default() -> Self {
        Self::new(MAX_FRAME_BYTES)
    }
}

/// Give released seeds their own worker namespace, outside the live content ids.
fn seed_id(generation: &str) -> String {
    format!("released:{generation}")
}

/// Compare compilation settings while ignoring evaluation identity.
pub(super) fn same_settings(retained: &Bundle, params: &Bundle) -> bool {
    let mut settings = retained.clone();
    settings.evaluation = params.evaluation.clone();
    settings == *params
}

#[cfg(test)]
#[path = "_tests_/pool_recipe_tests.rs"]
mod pool_recipe_tests;

#[cfg(test)]
#[path = "_tests_/recipe_support.rs"]
mod recipe_support;
