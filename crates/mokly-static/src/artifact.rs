//! Check final inventory paths before they become filesystem write paths.

use mokly_model::output::artifact::Artifact;
use mokly_model::output::validation::MARKER;

use crate::error::Result;
use crate::inventory::Inventory;

/// Check portable paths and path collisions before staging. The marker path
/// is fixed by finalization. Its typed inventory and immutable bytes are trusted.
pub(crate) fn validate(artifact: &Artifact) -> Result<()> {
    let mut inventory = Inventory::default();
    for file in &artifact.files {
        if file.path != MARKER {
            inventory.insert_path(&file.path)?;
        }
    }
    Ok(())
}
