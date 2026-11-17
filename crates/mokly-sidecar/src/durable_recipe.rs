//! Complete recipes whose capture was verified for optional disk persistence.

use std::ops::Deref;

use crate::reusable_recipe::ReusableRecipe;

/// Disk admission is stricter than memory reuse and released retention.
#[derive(Clone, Debug)]
pub struct DurableRecipe(ReusableRecipe);

impl DurableRecipe {
    /// Admit only complete evidence from a verified stable capture.
    pub fn new(recipe: ReusableRecipe) -> Option<Self> {
        recipe
            .compiled()
            .reuse_evidence
            .durable
            .then_some(Self(recipe))
    }
}

impl Deref for DurableRecipe {
    type Target = ReusableRecipe;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}
