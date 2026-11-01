//! The environment that every package manager child of a base install
//! starts from.
//!
//! Each install receives only the inherited variables on one allowed list,
//! plus the fixed names that Mokly sets. Lifecycle scripts are children of
//! the manager, so they receive the same environment.

use std::ffi::OsStr;

/// Whether an inherited variable is on the allowed list that every install
/// starts from. Mokly removes every other inherited variable, so a base
/// configuration and its lifecycle scripts receive no secret such as
/// `MOKLY_TOKEN`, `GITHUB_TOKEN`, or `NPM_TOKEN`. Mokly adds its own fixed
/// names separately, with the values that `manager_command::variables` sets.
/// This is the single rule for the install environment. Windows reads a
/// variable name without case, so the names match without case there.
pub(crate) fn allowed(inherited: &OsStr) -> bool {
    const NAMES: &[&str] = &[
        "PATH",
        "HOME",
        "HTTP_PROXY",
        "HTTPS_PROXY",
        "NO_PROXY",
        "ALL_PROXY",
        "http_proxy",
        "https_proxy",
        "no_proxy",
        "all_proxy",
        "NODE_EXTRA_CA_CERTS",
        "SSL_CERT_FILE",
        "SSL_CERT_DIR",
        "TMPDIR",
        "LANG",
        "LC_ALL",
        "TZ",
        "USER",
        "LOGNAME",
        "SystemRoot",
        "windir",
        "ComSpec",
        "PATHEXT",
        "TEMP",
        "TMP",
        "USERPROFILE",
        "APPDATA",
        "LOCALAPPDATA",
        "HOMEDRIVE",
        "HOMEPATH",
        "NUMBER_OF_PROCESSORS",
        "PROCESSOR_ARCHITECTURE",
    ];
    let name = inherited.to_string_lossy();
    let matches = |listed: &str| {
        if cfg!(windows) {
            listed.eq_ignore_ascii_case(&name)
        } else {
            listed == name
        }
    };
    if NAMES.iter().any(|listed| matches(listed)) {
        return true;
    }
    // Every locale category, for example LC_CTYPE and LC_TIME.
    match name.get(..3) {
        Some(prefix) if cfg!(windows) => prefix.eq_ignore_ascii_case("LC_"),
        Some(prefix) => prefix == "LC_",
        None => false,
    }
}
