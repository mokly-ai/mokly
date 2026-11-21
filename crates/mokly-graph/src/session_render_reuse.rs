//! Deferred facts borrow the exact inputs already owned by the retained generation.

use crate::render_calculation;
use crate::render_inputs::with_catalogue_inputs;
use crate::session::Session;

impl Session {
    /// Derive temporary seed inputs only when this generation's cell needs initialization.
    pub(crate) fn prepare_render_inputs(&self) {
        let Some(keys) = &self.state.inputs.render_keys else {
            return;
        };
        let catalogue = &self.state.catalogue;
        let Some(generation) = &catalogue.javascript.generation else {
            return;
        };
        keys.seed_with(|| {
            with_catalogue_inputs(
                &self.state.config,
                catalogue,
                generation,
                render_calculation::facts,
            )
        });
    }
}
