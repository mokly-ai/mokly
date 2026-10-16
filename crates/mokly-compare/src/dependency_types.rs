//! Bundle preparation inputs and typed dependency-tier results.

use std::path::PathBuf;

use mokly_git::identity::RepoPath;
use mokly_sidecar::methods::ModuleResolution;

use crate::cache_types::Lease;
use crate::inputs::Inputs;

/// Selected third-party dependency tier.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Tier {
    /// Equal clean dependency identities reuse working third-party dependencies.
    Working,
    /// Different inputs use the base installation cache.
    Installed,
    /// An impossible install reuses working third-party dependencies with a warning.
    Fallback,
}

/// Why base third-party dependencies could not be installed.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Fallback {
    /// Manager, executable or lockfile is unavailable.
    Unavailable,
    /// Package-manager execution failed, including an offline install.
    Failed,
    /// The install reached its shared deadline.
    Timeout,
    /// Install or retained entries exceeded the byte budget.
    Size,
    /// A local dependency points outside the source repository.
    LocalOutside,
    /// Malformed input cannot be installed safely.
    InvalidInput,
    /// An ancestor directory used by the head is absent from the base installation.
    MissingDirectory(String),
    /// Importer lookup uses a directory outside the supported base mapping.
    UnmappedDirectory(String),
    /// Cache preparation failed.
    Cache,
}

/// Configuration-subject build warning for a fallback.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Warning {
    /// Repository-relative configuration file.
    pub configuration: RepoPath,
    /// Differing lockfile, or a selected lockfile for a manifest-only change.
    pub lockfile: Option<RepoPath>,
    /// Typed cause selected without string matching.
    pub reason: Fallback,
}

impl Warning {
    /// Stable build warning code.
    pub fn code(&self) -> &'static str {
        "base-dependencies"
    }

    /// Single-line product message, with a reason and no invented lockfile.
    pub fn message(&self) -> String {
        let location = self
            .lockfile
            .as_ref()
            .map(|path| format!(" at {}", quoted(path.as_str())))
            .unwrap_or_default();
        let reason = match &self.reason {
            Fallback::Unavailable => "package manager or lockfile unavailable",
            Fallback::Failed => "installation failed",
            Fallback::Timeout => "time limit",
            Fallback::Size => "cache size limit",
            Fallback::LocalOutside => "local package outside the repository",
            Fallback::InvalidInput => "invalid dependency input",
            Fallback::Cache => "cache unavailable",
            Fallback::UnmappedDirectory(directory) => {
                return format!(
                    "base dependency lookup{location} cannot preserve {}; using working-tree dependencies (configure moduleResolution.packageRoots)",
                    quoted(directory)
                );
            }
            Fallback::MissingDirectory(directory) => {
                return format!(
                    "base dependencies{location} lack {}; using working-tree dependencies",
                    quoted(directory)
                );
            }
        };
        format!(
            "base dependencies{location} could not be installed ({reason}); using working-tree dependencies"
        )
    }
}

/// Base-side bundle inputs. The caller retains the extraction lease.
pub struct Request {
    /// Base manifests and lockfiles from blobs.
    pub base: Inputs,
    /// Working dependency inputs in Git's clean form.
    pub head: Inputs,
    /// Leased extraction containing this side's repository packages.
    pub source_root: PathBuf,
    /// Pinned commit identity.
    pub source_identity: String,
    /// Working repository root for tier one and three third-party dependencies.
    pub head_root: PathBuf,
    /// Build warning subject.
    pub configuration: RepoPath,
    /// Ancestor node_modules directories actually used by the current side.
    pub used_directories: Vec<String>,
    /// Used directories whose importer lookup the base cannot preserve.
    pub unmapped_directories: Vec<String>,
    /// Normalized repository-relative package roots and other settings.
    pub resolution: ModuleResolution,
}

/// All paths and leases needed by the sidecar's bundle request.
pub struct Resolved {
    /// Selected third-party dependency tier.
    pub tier: Tier,
    /// Primary third-party dependency directory.
    pub node_modules: PathBuf,
    /// Selected third-party package roots and the other bundle settings.
    pub module_resolution: ModuleResolution,
    /// Configuration warning in tier three.
    pub warning: Option<Warning>,
    /// Base installation lease, if used.
    pub lease: Option<Lease>,
    /// Real repository roots whose non-node_modules files map into this side's sources.
    /// Includes the working root and the tier-two source copy when present.
    pub repository_roots: Vec<PathBuf>,
}

fn quoted(value: &str) -> String {
    let mut output = String::from("\"");
    for character in value.chars() {
        match character {
            character if character.is_control() => {
                output.push_str(&format!("\\u{:04x}", u32::from(character)))
            }
            '\\' => output.push_str("\\\\"),
            '"' => output.push_str("\\\""),
            character => output.push(character),
        }
    }
    output.push('"');
    output
}
