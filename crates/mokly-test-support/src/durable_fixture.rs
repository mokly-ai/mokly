//! Private owner slots prevent fixture creation from changing another capture's ancestors.

use std::fs;
use std::io;
use std::path::Path;

use tempfile::TempDir;

/// One concurrent test owns each persistent parent and its scoped temporary children.
#[derive(Clone, Copy, Debug)]
pub enum Owner {
    /// Warm disk recipes provide the first edit plan.
    CompareWarmPlan,
    /// Changed inputs replace a persisted compilation.
    CompareRecipeReplacement,
    /// Restarted disk recipes observe absolute mapped targets.
    CompareAbsolutePaths,
    /// Restarted disk recipes observe interpolated configuration targets.
    CompareConfigDir,
    /// Sequential Serve edits retain or reject resolution plans.
    RenderPlanChanges,
    /// Serve plans reject an earlier absolute mapped target.
    RenderAbsolutePaths,
}

const OWNERS: &[Owner] = &[
    Owner::CompareWarmPlan,
    Owner::CompareRecipeReplacement,
    Owner::CompareAbsolutePaths,
    Owner::CompareConfigDir,
    Owner::RenderPlanChanges,
    Owner::RenderAbsolutePaths,
];

impl Owner {
    fn directory(self) -> &'static str {
        match self {
            Self::CompareWarmPlan => "compare-warm-plan",
            Self::CompareRecipeReplacement => "compare-recipe-replacement",
            Self::CompareAbsolutePaths => "compare-absolute-paths",
            Self::CompareConfigDir => "compare-config-dir",
            Self::RenderPlanChanges => "render-plan-changes",
            Self::RenderAbsolutePaths => "render-absolute-paths",
        }
    }
}

/// Create a scoped fixture after both runtime namespaces and every Rust owner exist.
///
/// Each concurrent test must use a different owner. Fixed parents stay present after
/// cleanup. External ancestor writes and duplicate concurrent owners remain shared.
pub fn create(owner: Owner) -> io::Result<TempDir> {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../target/durable-capture-fixtures");
    for runtime in ["rust", "node"] {
        fs::create_dir_all(root.join(runtime))?;
    }
    let rust = root.join("rust");
    for owner in OWNERS {
        fs::create_dir_all(rust.join(owner.directory()))?;
    }
    tempfile::tempdir_in(rust.join(owner.directory()))
}
