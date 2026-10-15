//! Consumer plugin provenance and directory watch recipes.

/// A protected stylesheet input reported by a consumer plugin.
#[derive(Clone, Debug, Eq, PartialEq, Ord, PartialOrd)]
pub struct PluginInput {
    /// Plugin name, or `unknown` when no name was reported.
    pub plugin: String,
    /// Logical stylesheet whose transform reported this input.
    pub stylesheet: String,
}

/// An allowed directory remains watched when its current glob matches no file.
#[derive(Clone, Debug, Eq, PartialEq, Ord, PartialOrd)]
pub struct DirectoryDependency {
    /// Repository-relative logical directory, including a reported alias.
    pub path: String,
    /// Case-sensitive directory-relative glob.
    pub glob: String,
    /// Reporting transform.
    pub origin: PluginInput,
}
