//! Detect generated-name collisions across CSS Module delivery roots.

use std::collections::BTreeMap;

use crate::error::{CssError, Result, TransformFailure};
use crate::modules::scoped_name;

/// Pure identity inventory shared across every stylesheet of a generation.
#[derive(Default)]
pub struct ModuleNames {
    names: BTreeMap<String, (String, String)>,
}

impl ModuleNames {
    /// Register class maps without treating repeated delivery of one source as a collision.
    pub fn register(&mut self, maps: &BTreeMap<String, BTreeMap<String, String>>) -> Result<()> {
        for (path, exports) in maps {
            for local in exports.keys() {
                self.record(scoped_name(path, local), path, local)?;
            }
        }
        Ok(())
    }

    fn record(&mut self, generated: String, path: &str, local: &str) -> Result<()> {
        if let Some((first, name)) = self.names.get(&generated) {
            if first != path || name != local {
                return Err(CssError::Transform {
                    kind: TransformFailure::Collision,
                    message: format!(
                        "CSS Modules generated name collision: {generated} in {first} and {path}; rename one local name or file"
                    ),
                });
            }
        } else {
            self.names.insert(generated, (path.into(), local.into()));
        }
        Ok(())
    }
}

#[cfg(test)]
#[path = "_tests_/names_tests.rs"]
mod names_tests;
