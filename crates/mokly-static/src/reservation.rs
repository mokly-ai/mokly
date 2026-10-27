//! Exclusive writer admission and non-recursive reservation cleanup.

use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::error::{Error, InternalError, Result};
use crate::filesystem::{Entry, Files};
use crate::location;

const OWNER: &[u8] = b"mokly-export-reservations-v1\n";
const TRANSACTION: &str = ".mokly-export-transaction";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Marker<'a> {
    schema_version: u32,
    output: &'a str,
}

/// Admits one writer with an atomic `mkdir` of `locks/` plus the output
/// basename in the namespace beside the output. The caller passes the native
/// real path and the basename stays unmodified, so the output filesystem's own
/// case and alias rules decide which outputs share a lock.
pub(crate) fn acquire(files: &dyn Files, output: &Path) -> Result<PathBuf> {
    let parent = output.parent().ok_or_else(|| Error::Destination {
        path: output.into(),
    })?;
    let name = output
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| Error::Destination {
            path: output.into(),
        })?;
    location::directories(files, parent)?;
    let namespace = parent.join(".mokly-export-reservations");
    if files.entry(&namespace)?.is_none() {
        match files.mkdir(&namespace) {
            Ok(()) => files.write(&namespace.join(".owner"), OWNER)?,
            Err(_) => check_namespace(files, &namespace)?,
        }
    }
    check_namespace(files, &namespace)?;
    let locks = namespace.join("locks");
    location::directories(files, &locks)?;
    let reservation = locks.join(name);
    if files.mkdir(&reservation).is_err() {
        return Err(Error::Reserved { path: reservation });
    }
    let bytes = match serde_json::to_vec(&Marker {
        schema_version: 2,
        output: name,
    }) {
        Ok(bytes) => bytes,
        Err(source) => return Err(InternalError::Json { source }.into()),
    };
    if let Err(primary) = files.write(&reservation.join(TRANSACTION), &bytes) {
        return match cleanup(files, &reservation) {
            Ok(()) => Err(primary),
            Err(cleanup) => Err(Error::Recovery {
                primary: Box::new(primary),
                cleanup: Box::new(cleanup),
                path: reservation,
            }),
        };
    }
    Ok(reservation)
}

fn check_namespace(files: &dyn Files, namespace: &Path) -> Result<()> {
    if !matches!(files.entry(namespace)?, Some(Entry::Directory(_)))
        || !matches!(
            files.entry(&namespace.join(".owner"))?,
            Some(Entry::File(_))
        )
        || files.read(&namespace.join(".owner"), OWNER.len())? != OWNER
    {
        return Err(Error::Unexpected {
            path: namespace.into(),
        });
    }
    Ok(())
}

/// Removes a finished reservation. A non-following stat refuses any backup
/// entry, also a dangling symlink. Only the private stage is removed
/// recursively. The marker is unlinked and the reservation removed with
/// `rmdir`, so a later unowned entry is never swept away. An absent
/// reservation is a no-op.
pub(crate) fn cleanup(files: &dyn Files, root: &Path) -> Result<()> {
    if files.entry(root)?.is_none() {
        return Ok(());
    }
    if files.entry(&root.join("backup"))?.is_some() {
        return Err(Error::Unexpected {
            path: root.join("backup"),
        });
    }
    files.remove_stage(&root.join("stage"))?;
    let marker = root.join(TRANSACTION);
    if files.entry(&marker)?.is_some() {
        files.unlink(&marker)?;
    }
    files.rmdir(root)
}
