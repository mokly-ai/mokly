//! Shared secret environment names excluded from every xtask subprocess.

/// Secret variables that subprocess builders must explicitly remove.
pub(crate) const SECRET_VARIABLES: &[&str] = &["BLACKSMITH_ORG_TOKEN"];
