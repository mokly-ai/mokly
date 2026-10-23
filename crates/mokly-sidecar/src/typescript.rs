//! Generated Node sidecar protocol declarations.

use std::collections::BTreeMap;

use mokly_model::type_modules::TypeModules;

use crate::methods::Call;
use crate::wire::{Frame, MethodResult, Request};

/// Generate each wire type and all dependencies into its own source module.
pub fn generate() -> BTreeMap<String, String> {
    let mut modules = TypeModules::default();
    modules.add::<Request>();
    modules.add::<Call>();
    modules.add::<Frame>();
    modules.add::<MethodResult>();
    modules.finish()
}
