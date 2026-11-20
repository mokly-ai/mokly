//! Strict desktop-client admission configuration shared by both servers.

use crate::settings::{EnvironmentConfig, Error, Result};

pub(crate) trait DesktopConfig {
    fn desktop_client(&self) -> Result<bool>;
}

impl DesktopConfig for EnvironmentConfig {
    fn desktop_client(&self) -> Result<bool> {
        match self.environment.get("MKC_DESKTOP_CLIENT").as_deref() {
            None | Some("false") => Ok(false),
            Some("true") => Ok(true),
            Some(_) => Err(Error::Invalid("MKC_DESKTOP_CLIENT")),
        }
    }
}

#[cfg(test)]
#[path = "_tests_/desktop_tests.rs"]
mod tests;
