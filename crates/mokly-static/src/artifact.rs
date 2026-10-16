//! Validate immutable bytes before allowing an inventory to become write paths.

use std::collections::BTreeMap;

use mokly_model::output::artifact::Artifact;
use mokly_model::output::ownership::Ownership;
use mokly_model::output::validation::{MARKER, digest};

use crate::error::{Error, Result};
use crate::inventory::Inventory;

pub(crate) fn validate(artifact: &Artifact) -> Result<()> {
    let mut paths = BTreeMap::new();
    let mut inventory = Inventory::default();
    for file in &artifact.files {
        if paths.insert(file.path.as_str(), file).is_some() {
            return Err(Error::Collision {
                path: file.path.clone(),
                other: file.path.clone(),
            });
        }
        if file.path != MARKER {
            inventory.insert(file.path.clone(), file.bytes.clone())?;
        }
    }
    let marker = paths.get(MARKER).ok_or_else(|| Error::Invalid {
        path: MARKER.into(),
    })?;
    let ownership = match Ownership::parse(&marker.bytes) {
        Ok(ownership) => ownership,
        Err(_) => {
            return Err(Error::Ownership {
                path: artifact.directory.clone(),
            });
        }
    };
    if ownership.files.len() + 1 != paths.len()
        || artifact.files.last().map(|file| file.path.as_str()) != Some(MARKER)
    {
        return Err(Error::Invalid {
            path: MARKER.into(),
        });
    }
    for entry in ownership.files {
        if !paths.get(entry.path.as_str()).is_some_and(|file| {
            file.bytes.len() as u64 == entry.size && digest(&file.bytes) == entry.sha256
        }) {
            return Err(Error::Invalid { path: entry.path });
        }
    }
    Ok(())
}
