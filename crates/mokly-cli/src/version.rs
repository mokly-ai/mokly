//! The public package owns the native executable version.

/// Version embedded from packages/mokly/package.json by the build script.
pub const VERSION: &str = env!("MOKLY_VERSION");
