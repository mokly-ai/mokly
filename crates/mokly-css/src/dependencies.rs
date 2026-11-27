//! Consumer plugin provenance and directory watch recipes.

/// How the head loaded a file that Changes must check against Git.
/// In a conflict, an exact plugin stylesheet report takes priority.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd)]
pub enum ImportKind {
    /// A synchronous package require that may recover its source in the base.
    NodePackage,
    /// A load of an exact file.
    File,
    /// A bundled or stylesheet import by package name.
    Package,
    /// An exact plugin stylesheet dependency needs the reported file.
    PluginStylesheet,
}

/// A protected stylesheet input reported by a consumer plugin.
#[derive(Clone, Debug, Eq, PartialEq, Ord, PartialOrd)]
pub struct PluginInput {
    /// Plugin name, or `unknown` when no name was reported.
    pub plugin: String,
    /// Logical stylesheet whose transform reported this input.
    pub stylesheet: String,
    /// Load evidence, absent for a watch-only input.
    pub import: Option<ImportKind>,
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
