//! Complete recipes for optional seeds and bounded stores.

use std::sync::Arc;

use crate::compiled::{CompiledGeneration, RestoreGeneration};
use crate::methods::{Bundle, Call};
use crate::results::Module;
use crate::wire::Request;

/// A recipe whose recorded inputs permit optional compilation reuse.
#[derive(Clone, Debug)]
pub struct ReusableRecipe {
    generation: String,
    params: Bundle,
    modules: Vec<Module>,
    compiled: Arc<CompiledGeneration>,
}

impl ReusableRecipe {
    /// Admit complete evidence without changing explicit live restoration.
    pub fn new(
        generation: String,
        params: Bundle,
        modules: Vec<Module>,
        compiled: Arc<CompiledGeneration>,
    ) -> Option<Self> {
        if !compiled.reuse_evidence.complete {
            return None;
        }
        Some(Self {
            generation,
            params,
            modules,
            compiled,
        })
    }

    /// Original generation name before its optional seed namespace.
    pub fn generation(&self) -> &str {
        &self.generation
    }

    /// Original bundle parameters, including evaluation identity.
    pub fn params(&self) -> &Bundle {
        &self.params
    }

    /// Captured module graph.
    pub fn modules(&self) -> &[Module] {
        &self.modules
    }

    /// Shared immutable compilation.
    pub fn compiled(&self) -> &Arc<CompiledGeneration> {
        &self.compiled
    }
}

/// Build the exact request whose encoded size a disk write must permit.
pub fn disk_seed_request(recipe: &ReusableRecipe) -> Request {
    Request {
        id: 1,
        call: Call::RestoreGeneration(Box::new(RestoreGeneration {
            generation: format!("disk:{}", recipe.generation),
            params: recipe.params.clone(),
            modules: recipe.modules.clone(),
            compiled: (*recipe.compiled).clone(),
        })),
    }
}

#[cfg(test)]
#[path = "_tests_/reusable_recipe_tests.rs"]
mod reusable_recipe_tests;
