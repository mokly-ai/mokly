//! Admitted dependency-parent failures use the existing observer warning channel.

use std::collections::BTreeSet;
use std::path::PathBuf;

use crate::backend::DirectoryWatch;
use crate::error::Result;
use crate::observer::Inbox;

pub(crate) fn update(
    watcher: &mut dyn DirectoryWatch,
    add: &BTreeSet<PathBuf>,
    remove: &BTreeSet<PathBuf>,
    advisory: &BTreeSet<PathBuf>,
    inbox: &Inbox,
) -> Result<BTreeSet<PathBuf>> {
    let required_add: BTreeSet<_> = add.difference(advisory).cloned().collect();
    let required_remove: BTreeSet<_> = remove.difference(advisory).cloned().collect();
    let mut attached = if required_add.is_empty() && required_remove.is_empty() {
        BTreeSet::new()
    } else {
        watcher.update(&required_add, &required_remove)?
    };
    let advisory_add: BTreeSet<_> = add.intersection(advisory).cloned().collect();
    let advisory_remove: BTreeSet<_> = remove.intersection(advisory).cloned().collect();
    if advisory_add.is_empty() && advisory_remove.is_empty() {
        return Ok(attached);
    }
    match watcher.update(&advisory_add, &advisory_remove) {
        Ok(paths) => attached.extend(paths),
        Err(error) => inbox.send(Err(error)),
    }
    Ok(attached)
}
