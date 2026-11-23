//! Captured and explicitly live-only recipes for bounded optional reuse.

use std::sync::Arc;

use crate::compiled::{CompiledGeneration, RestoreGeneration};
use crate::durable_recipe::DurableRecipe;
use crate::methods::{Bundle, BundleCapture, Call};
use crate::results::Module;
use crate::wire::Request;

/// A recipe whose recorded inputs permit optional compilation reuse.
#[derive(Clone, Debug)]
pub struct ReusableRecipe {
    generation: String,
    params: Bundle,
    modules: Arc<Vec<Module>>,
    compiled: Arc<CompiledGeneration>,
}

impl ReusableRecipe {
    /// Admit captured inputs or an explicit Serve edit omission for bounded reuse.
    pub fn new(
        generation: String,
        params: Bundle,
        modules: Arc<Vec<Module>>,
        compiled: Arc<CompiledGeneration>,
    ) -> Option<Self> {
        if !compiled.reuse_evidence.reusable(BundleCapture::ServeEdit)
            || compiled.reuse_evidence.serve_edit() && compiled.toolchain.is_empty()
        {
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
    pub fn modules(&self) -> &Arc<Vec<Module>> {
        &self.modules
    }

    /// Shared immutable compilation.
    pub fn compiled(&self) -> &Arc<CompiledGeneration> {
        &self.compiled
    }
}

/// Build the exact request whose encoded size a disk write must permit.
pub fn disk_seed_request(recipe: &DurableRecipe) -> Request {
    Request {
        id: 1,
        quiet: false,
        call: Call::RestoreGeneration(Box::new(RestoreGeneration {
            generation: format!("disk:{}", recipe.generation),
            params: recipe.params.clone(),
            modules: recipe.modules.clone(),
            compiled: recipe.compiled.clone(),
        })),
    }
}

#[cfg(test)]
#[path = "_tests_/reusable_recipe_tests.rs"]
mod reusable_recipe_tests;
