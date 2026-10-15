//! Confinement survives a root retarget between eligibility and the open call.

#![cfg(unix)]

use std::path::PathBuf;
use std::sync::Arc;

use mokly_graph::policy::{PublicFile, PublicPolicy};
use mokly_graph::public_denial::PublicDenial;
use mokly_server::public_read::{ConfinedReader, PublicReader};
use tempfile::TempDir;

struct Retarget {
    root: PathBuf,
    outside: PathBuf,
    moved: PathBuf,
}
impl PublicPolicy for Retarget {
    fn check(&self, path: &str) -> Result<PublicFile, PublicDenial> {
        Ok(PublicFile {
            path: path.into(),
            absolute: self.root.join(path),
        })
    }
    fn recheck(&self, path: &str) -> Result<PublicFile, PublicDenial> {
        let accepted = self.check(path)?;
        std::fs::rename(&self.root, &self.moved).unwrap();
        std::os::unix::fs::symlink(&self.outside, &self.root).unwrap();
        Ok(accepted)
    }
}

#[test]
fn a_root_replaced_after_policy_validation_cannot_expose_outside_bytes() {
    let arena = TempDir::new().unwrap();
    let root = arena.path().join("repo");
    let outside = arena.path().join("outside");
    std::fs::create_dir(&root).unwrap();
    std::fs::create_dir(&outside).unwrap();
    std::fs::write(root.join("asset.txt"), "public").unwrap();
    std::fs::write(outside.join("asset.txt"), "outside secret").unwrap();
    let reader: &dyn PublicReader = &ConfinedReader {
        repo_root: root.clone(),
        policy: Arc::new(Retarget {
            root,
            outside,
            moved: arena.path().join("moved"),
        }),
    };
    assert!(reader.read("asset.txt").is_none());
}
