//! Validated suite, shard, and dependency audit selections.

use std::fmt;
use std::str::FromStr;

use clap::ValueEnum;

use crate::error::{Error, Result};

/// Largest shard value that Node and Playwright can represent exactly.
const MAX_JAVASCRIPT_SAFE_INTEGER: u64 = 9_007_199_254_740_991;

/// Workspace dependency audit policy for repository verification.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq, ValueEnum)]
pub(crate) enum DependencyAudit {
    /// Fail on new issues relative to the comparison commit.
    #[default]
    Baseline,
    /// Fail on every uncovered finding or invalid exception.
    Strict,
}

/// Independently executable verification ownership areas.
#[derive(Clone, Copy, Debug, Eq, PartialEq, ValueEnum)]
pub(crate) enum VerificationSuite {
    /// Audit, formatting, lint, and Rust verification.
    Repository,
    /// Declarations, example, package inspection, and packed consumers.
    Package,
    /// Node unit and integration tests.
    Unit,
    /// Playwright browser tests.
    Browser,
    /// Unsharded Playwright hydration tests.
    Hydration,
}

impl VerificationSuite {
    /// Suites in authoritative complete-gate order.
    pub(crate) const ALL: [Self; 5] = [
        Self::Repository,
        Self::Package,
        Self::Unit,
        Self::Browser,
        Self::Hydration,
    ];

    /// Stable CLI name for the suite.
    pub(crate) const fn as_str(self) -> &'static str {
        match self {
            Self::Repository => "repository",
            Self::Package => "package",
            Self::Unit => "unit",
            Self::Browser => "browser",
            Self::Hydration => "hydration",
        }
    }

    fn supports_shards(self) -> bool {
        matches!(self, Self::Unit | Self::Browser)
    }
}

impl fmt::Display for VerificationSuite {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

/// One-based whole-file shard selection.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) struct Shard {
    index: u64,
    total: u64,
}

impl fmt::Display for Shard {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{}/{}", self.index, self.total)
    }
}

impl FromStr for Shard {
    type Err = Error;

    fn from_str(value: &str) -> Result<Self> {
        let Some((index, total)) = value.split_once('/') else {
            return Err(invalid_shard(value));
        };
        if total.contains('/') {
            return Err(invalid_shard(value));
        }
        let Ok(index) = index.parse::<u64>() else {
            return Err(invalid_shard(value));
        };
        let Ok(total) = total.parse::<u64>() else {
            return Err(invalid_shard(value));
        };
        if index == 0
            || total == 0
            || index > total
            || index > MAX_JAVASCRIPT_SAFE_INTEGER
            || total > MAX_JAVASCRIPT_SAFE_INTEGER
        {
            return Err(invalid_shard(value));
        }
        Ok(Self { index, total })
    }
}

/// Validated complete or partial verification selection.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) struct CheckRequest {
    /// Selected suite, or every suite when omitted.
    pub(super) suite: Option<VerificationSuite>,
    /// Validated whole-file shard for a unit or browser suite.
    pub(super) shard: Option<Shard>,
    /// Resolved audit mode; omission selects baseline.
    pub(super) dependency_audit: DependencyAudit,
}

impl CheckRequest {
    /// Validate explicit options before subprocesses start and default the audit.
    pub(crate) fn new(
        suite: Option<VerificationSuite>,
        shard: Option<Shard>,
        dependency_audit: Option<DependencyAudit>,
    ) -> Result<Self> {
        if dependency_audit.is_some()
            && let Some(suite) = suite
            && suite != VerificationSuite::Repository
        {
            return Err(Error::UnsupportedDependencyAudit { suite });
        }
        if shard.is_some() {
            let Some(suite) = suite else {
                return Err(Error::ShardRequiresSuite);
            };
            if !suite.supports_shards() {
                return Err(Error::UnsupportedShard { suite });
            }
        }
        Ok(Self {
            suite,
            shard,
            dependency_audit: dependency_audit.unwrap_or_default(),
        })
    }
}

fn invalid_shard(shard: &str) -> Error {
    Error::InvalidShard {
        shard: shard.to_owned(),
    }
}
