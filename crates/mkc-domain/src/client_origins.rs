//! Exact browser-origin admission shared by authentication and catalogue delivery.

use std::iter;

/// Privileged origin served by the installed desktop shell.
pub const DESKTOP_ORIGIN: &str = "mokly-app://desktop";

/// Admitted request origin, independent of HTTP transport.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ClientOrigin {
    /// Public application origin.
    App,
    /// Installed desktop shell origin.
    Desktop,
}

/// Exact origins admitted by one process, built from validated startup settings.
#[derive(Clone, Debug)]
pub struct AdmittedOrigins {
    app_origin: String,
    desktop_client: bool,
}

impl AdmittedOrigins {
    /// Admit the public application and optionally the installed desktop shell.
    pub fn new(app_origin: String, desktop_client: bool) -> Self {
        Self {
            app_origin,
            desktop_client,
        }
    }

    /// Public application origin used for externally visible links.
    pub fn app_origin(&self) -> &str {
        &self.app_origin
    }

    /// Classify an exact Origin header; absent and unadmitted origins have no client.
    pub fn classify(&self, origin: Option<&str>) -> Option<ClientOrigin> {
        match origin {
            Some(origin) if origin == self.app_origin => Some(ClientOrigin::App),
            Some(DESKTOP_ORIGIN) if self.desktop_client => Some(ClientOrigin::Desktop),
            _ => None,
        }
    }

    /// Enumerate the same exact origins for CORS and frame ancestors.
    pub fn iter(&self) -> impl Iterator<Item = &str> {
        iter::once(self.app_origin.as_str()).chain(self.desktop_client.then_some(DESKTOP_ORIGIN))
    }
}

#[cfg(test)]
#[path = "_tests_/client_origins_tests.rs"]
mod tests;
