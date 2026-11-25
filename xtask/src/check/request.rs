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

impl DependencyAudit {
    /// Stable CLI name for the audit mode.
    pub(crate) const fn as_str(self) -> &'static str {
        match self {
            Self::Baseline => "baseline",
            Self::Strict => "strict",
        }
    }
}

impl fmt::Display for DependencyAudit {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

/// Independently executable verification ownership areas.
#[derive(Clone, Copy, Debug, Eq, PartialEq, ValueEnum)]
pub(crate) enum VerificationSuite {
    /// Audit, formatting, lint, and Rust verification.
    Repository,
    /// Viewer typecheck and Node tooling and viewer tests.
    Viewer,
    /// Host native artifact and Rust tests for hosted macOS and Windows jobs.
    Native,
    /// Playwright checks of the served example and viewer hosts.
    Browser,
    /// Clippy and tests for the cloud Rust crates.
    CloudRust,
    /// Append-only cloud migration checks.
    CloudMigrations,
    /// Typecheck every cloud npm project.
    CloudTypecheck,
    /// Cloud application logic, export, and browser tests.
    CloudApp,
    /// Cloud mockup compilation, policy, smoke, and type checks.
    CloudMockups,
    /// Marketing site build, types, links, and browser tests.
    CloudSite,
    /// Rust-owned OpenAPI document and client drift.
    CloudOpenapi,
    /// Workspace-built Mokly contract fixture drift.
    CloudFixtures,
    /// Committed email template drift and mutation tests.
    CloudEmails,
    /// OpenAPI reason, prose, and GitHub fixture contracts.
    CloudOpenapiLint,
    /// Terraform formatting, validation, and mock-provider tests.
    CloudTerraform,
    /// Cloudflare origin-router types and tests.
    CloudOriginRouter,
    /// Helm lint, golden renders, and rejected values.
    CloudHelm,
    /// Infrastructure contracts, BuildKit storage, and workload images.
    CloudInfrastructure,
    /// Electron shell logic, bundled export, and real-API smoke.
    CloudDesktop,
    /// Protocol and installed cloud toolchain pin agreement.
    CloudToolchainPins,
}

impl VerificationSuite {
    /// Local coverage without repeating the native build and workspace tests.
    pub(crate) fn local() -> impl Iterator<Item = Self> {
        [Self::Repository, Self::Viewer, Self::Browser]
            .into_iter()
            .chain(Self::CLOUD)
    }

    /// Cloud suites used by the complete local and remote gates.
    pub(crate) const CLOUD: [Self; 16] = [
        Self::CloudToolchainPins,
        Self::CloudRust,
        Self::CloudMigrations,
        Self::CloudTypecheck,
        Self::CloudApp,
        Self::CloudMockups,
        Self::CloudSite,
        Self::CloudOpenapi,
        Self::CloudFixtures,
        Self::CloudEmails,
        Self::CloudOpenapiLint,
        Self::CloudTerraform,
        Self::CloudOriginRouter,
        Self::CloudHelm,
        Self::CloudInfrastructure,
        Self::CloudDesktop,
    ];

    /// Stable CLI name for the suite.
    pub(crate) const fn as_str(self) -> &'static str {
        match self {
            Self::Repository => "repository",
            Self::Viewer => "viewer",
            Self::Native => "native",
            Self::Browser => "browser",
            Self::CloudRust => "cloud-rust",
            Self::CloudMigrations => "cloud-migrations",
            Self::CloudTypecheck => "cloud-typecheck",
            Self::CloudApp => "cloud-app",
            Self::CloudMockups => "cloud-mockups",
            Self::CloudSite => "cloud-site",
            Self::CloudOpenapi => "cloud-openapi",
            Self::CloudFixtures => "cloud-fixtures",
            Self::CloudEmails => "cloud-emails",
            Self::CloudOpenapiLint => "cloud-openapi-lint",
            Self::CloudTerraform => "cloud-terraform",
            Self::CloudOriginRouter => "cloud-origin-router",
            Self::CloudHelm => "cloud-helm",
            Self::CloudInfrastructure => "cloud-infrastructure",
            Self::CloudDesktop => "cloud-desktop",
            Self::CloudToolchainPins => "cloud-toolchain-pins",
        }
    }

    fn supports_shards(self) -> bool {
        matches!(
            self,
            Self::Browser | Self::CloudApp | Self::CloudMockups | Self::CloudSite
        )
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

impl Shard {
    /// Whether this shard owns non-browser logic tests.
    pub(super) fn is_first(self) -> bool {
        self.index == 1
    }

    /// One-based shard number.
    pub(super) fn index(self) -> u64 {
        self.index
    }

    /// Number of shards in the selection.
    pub(super) fn total(self) -> u64 {
        self.total
    }

    /// The shard of the remaining work after `leading` shards that own other work.
    ///
    /// Returns `None` for one of the leading shards.
    pub(super) fn after(self, leading: u64) -> Option<Self> {
        (self.index > leading).then(|| Self {
            index: self.index - leading,
            total: self.total - leading,
        })
    }
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
    /// Optional browser, cloud application, mockup, or site shard.
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

    /// Resolved audit mode for local and remote repository verification.
    pub(crate) const fn dependency_audit(&self) -> DependencyAudit {
        self.dependency_audit
    }
}

fn invalid_shard(shard: &str) -> Error {
    Error::InvalidShard {
        shard: shard.to_owned(),
    }
}
