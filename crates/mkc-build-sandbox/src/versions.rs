//! Released CLI fallback and minimum for upload envelope 3 and catalogue index 9.

use semver::Version;

/// Cloud fallback at 0.19.0; must equal the exact @mokly/mokly pin in package.json.
pub const CLOUD_MOKLY_VERSION: &str = "0.19.0";
/// First release that produces upload envelope 3 with catalogue index 9.
pub const MIN_MOKLY_VERSION: &str = "0.18.0";

pub(crate) fn supported(output: &[u8]) -> bool {
    let Ok(output) = str::from_utf8(output) else {
        return false;
    };
    let (Ok(version), Ok(minimum)) = (
        Version::parse(output.trim()),
        Version::parse(MIN_MOKLY_VERSION),
    ) else {
        return false;
    };
    !version.cmp_precedence(&minimum).is_lt()
}
