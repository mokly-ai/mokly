//! The public package owns the native executable version.

/// Version embedded from packages/mokly/package.json by the build script.
pub const VERSION: &str = env!("MOKLY_VERSION");

#[used]
pub static REMOTE_FRESH_NATIVE_PROBE: &[u8] = b"MOKLY_TEST_REMOTE_FRESH_NATIVE\0";
