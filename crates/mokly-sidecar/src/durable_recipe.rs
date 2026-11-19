//! Complete recipes whose capture was verified for optional disk persistence.

use std::ops::Deref;
use std::sync::Arc;

use crate::resolution_plan::ResolutionPlan;
use crate::reusable_recipe::ReusableRecipe;

/// Disk admission is stricter than memory reuse and released retention.
#[derive(Clone, Debug)]
pub struct DurableRecipe {
    recipe: ReusableRecipe,
    plan: Option<Arc<ResolutionPlan>>,
}

impl DurableRecipe {
    /// Attach optional bounded native targets beside the immutable compilation.
    pub fn with_plan(mut self, plan: Option<Arc<ResolutionPlan>>) -> Self {
        self.plan = plan.filter(|plan| {
            plan.record_bytes(&self.recipe.compiled().reuse_evidence)
                .is_some()
        });
        self
    }

    /// Native targets captured by this recipe's compilation, when retained.
    pub fn plan(&self) -> Option<&Arc<ResolutionPlan>> {
        self.plan.as_ref()
    }

    /// Admit only complete evidence from a verified stable capture.
    pub fn new(recipe: ReusableRecipe) -> Option<Self> {
        let evidence = &recipe.compiled().reuse_evidence;
        (evidence.captured() && evidence.durable).then_some(Self { recipe, plan: None })
    }
}

impl Deref for DurableRecipe {
    type Target = ReusableRecipe;

    fn deref(&self) -> &Self::Target {
        &self.recipe
    }
}
