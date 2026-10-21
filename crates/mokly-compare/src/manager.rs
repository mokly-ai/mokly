//! Supported package-manager dialects and exact version checks.

use crate::error::{Error, Result};
use crate::manager_classic::Configuration;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum Manager {
    Npm,
    Pnpm,
    YarnClassic,
    YarnBerry,
}

impl Manager {
    pub(crate) fn program(self) -> &'static str {
        match self {
            Self::Npm => "npm",
            Self::Pnpm => "pnpm",
            Self::YarnClassic | Self::YarnBerry => "yarn",
        }
    }

    pub(crate) fn identity(self) -> &'static str {
        match self {
            Self::Npm => "npm",
            Self::Pnpm => "pnpm",
            Self::YarnClassic => "yarn-classic",
            Self::YarnBerry => "yarn-berry",
        }
    }

    pub(crate) fn supports(self, version: &str) -> bool {
        if self == Self::Npm {
            return !version.is_empty();
        }
        let Some(major) = version_major(version) else {
            return false;
        };
        matches!(
            (self, major),
            (Self::Pnpm, 10..=12) | (Self::YarnClassic, 1) | (Self::YarnBerry, 4)
        )
    }
}

#[derive(Clone, Debug)]
pub(crate) struct Root {
    pub(crate) directory: String,
    pub(crate) manager: Manager,
    pub(crate) requested: Option<String>,
    pub(crate) version: String,
    pub(crate) classic: Option<Configuration>,
    pub(crate) berry_cache: Option<String>,
}

impl Root {
    pub(crate) fn validate_version(&mut self, output: &[u8]) -> Result<()> {
        let version = match str::from_utf8(output) {
            Ok(version) => version.trim(),
            Err(_) => return Err(Error::UnsupportedVersion),
        };
        if !self.manager.supports(version)
            || self
                .requested
                .as_ref()
                .is_some_and(|requested| requested != version)
        {
            return Err(Error::UnsupportedVersion);
        }
        self.version = version.to_owned();
        Ok(())
    }
}

pub(crate) fn version_major(version: &str) -> Option<u64> {
    let parts = version.split('.').collect::<Vec<_>>();
    if parts.len() != 3
        || parts
            .iter()
            .any(|part| part.is_empty() || !part.bytes().all(|byte| byte.is_ascii_digit()))
    {
        return None;
    }
    parts[0].parse().ok()
}
