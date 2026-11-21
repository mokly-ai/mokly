//! Typed readable address segments and their shared reserved names.

use std::fmt;
use std::str::FromStr;

use serde::{Deserialize, Deserializer, Serialize};
use thiserror::Error;
use unicode_normalization::UnicodeNormalization;
#[cfg(feature = "openapi")]
use utoipa::ToSchema;
use uuid::Uuid;

/// Maximum byte length of a workspace slug.
pub const WORKSPACE_SLUG_MAX_LENGTH: usize = 39;

/// Maximum byte length of a project slug.
pub const PROJECT_SLUG_MAX_LENGTH: usize = 100;

/// Site-owned first segments generated into the edge router's route table.
pub const SITE_FIRST_SEGMENTS: &[&str] = &[
    "_astro",
    "brand",
    "changelog",
    "changelog.xml",
    "complaints",
    "docs",
    "favicon.svg",
    "og",
    "pagefind",
    "pricing",
    "privacy",
    "robots.txt",
    "security",
    "sitemap.xml",
    "stage",
    "terms",
];

/// Site-owned segments handled explicitly rather than by the generated table.
pub const EXPLICIT_SITE_FIRST_SEGMENTS: &[&str] = &[".well-known"];

/// Current static top-level Expo route names, checked against the route tree.
pub const EXPO_STATIC_FIRST_SEGMENTS: &[&str] = &[
    "_sitemap",
    "auth",
    "connect",
    "dashboard",
    "install",
    "new",
    "projects",
    "settings",
    "sign-in",
    "sign-up",
    "workspaces",
];

/// App-owned and forward-protected first segments.
pub const APP_FIRST_SEGMENTS: &[&str] = &[
    "_config",
    "_expo",
    "_health",
    "_router-health",
    "_sitemap",
    "assets",
    "auth",
    "connect",
    "dashboard",
    "folio",
    "install",
    "mokly-viewer",
    "new",
    "organizations",
    "projects",
    "settings",
    "sign-in",
    "sign-up",
    "workspaces",
];

/// Mokly additions to the upstream GitHub-derived policy seed.
pub const POLICY_RESERVED_SLUGS: &[&str] = &["app", "mokly", "register", "www"];

const GITHUB_RESERVED_SLUGS: &str = include_str!("../data/github-reserved-names.txt");

/// A malformed slug supplied at a typed boundary.
#[derive(Clone, Copy, Debug, Error, PartialEq, Eq)]
#[error("[mkc-domain/slug] slug does not match the readable-address grammar")]
pub struct SlugError;

/// A globally scoped workspace address segment.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize)]
#[serde(transparent)]
#[cfg_attr(feature = "openapi", derive(ToSchema))]
#[cfg_attr(
    feature = "openapi",
    schema(
        description = "Lowercase workspace address segment. The API preserves the supplied value and also rejects values that parse as UUIDs.",
        min_length = 1,
        max_length = 39,
        pattern = "^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9]))*$"
    )
)]
pub struct WorkspaceSlug(String);

impl WorkspaceSlug {
    /// Read the validated segment.
    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// Consume the value into its stored spelling.
    pub fn into_string(self) -> String {
        self.0
    }
}

impl fmt::Display for WorkspaceSlug {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.0)
    }
}

impl FromStr for WorkspaceSlug {
    type Err = SlugError;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        validate(value, WORKSPACE_SLUG_MAX_LENGTH)?;
        Ok(Self(value.to_owned()))
    }
}

impl<'de> Deserialize<'de> for WorkspaceSlug {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        match String::deserialize(deserializer)?.parse() {
            Ok(slug) => Ok(slug),
            Err(error) => Err(serde::de::Error::custom(error)),
        }
    }
}

/// A workspace-scoped project address segment.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize)]
#[serde(transparent)]
#[cfg_attr(feature = "openapi", derive(ToSchema))]
#[cfg_attr(
    feature = "openapi",
    schema(
        description = "Lowercase project address segment. The API preserves the supplied value and also rejects values that parse as UUIDs.",
        min_length = 1,
        max_length = 100,
        pattern = "^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9]))*$"
    )
)]
pub struct ProjectSlug(String);

impl ProjectSlug {
    /// Read the validated segment.
    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// Consume the value into its stored spelling.
    pub fn into_string(self) -> String {
        self.0
    }
}

impl fmt::Display for ProjectSlug {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.0)
    }
}

impl FromStr for ProjectSlug {
    type Err = SlugError;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        validate(value, PROJECT_SLUG_MAX_LENGTH)?;
        Ok(Self(value.to_owned()))
    }
}

impl<'de> Deserialize<'de> for ProjectSlug {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        match String::deserialize(deserializer)?.parse() {
            Ok(slug) => Ok(slug),
            Err(error) => Err(serde::de::Error::custom(error)),
        }
    }
}

/// Whether a first segment belongs to the site, app or policy reserve.
pub fn is_reserved(value: &str) -> bool {
    SITE_FIRST_SEGMENTS.contains(&value)
        || EXPLICIT_SITE_FIRST_SEGMENTS.contains(&value)
        || APP_FIRST_SEGMENTS.contains(&value)
        || POLICY_RESERVED_SLUGS.contains(&value)
        || github_reserved_slugs().any(|reserved| reserved == value)
}

/// Whether a first segment belongs to the static marketing origin.
pub fn is_site_first_segment(value: &str) -> bool {
    SITE_FIRST_SEGMENTS.contains(&value) || EXPLICIT_SITE_FIRST_SEGMENTS.contains(&value)
}

/// Iterate the attributed GitHub-derived reserved-name seed.
pub fn github_reserved_slugs() -> impl Iterator<Item = &'static str> {
    GITHUB_RESERVED_SLUGS.lines()
}

/// Derive a bounded ASCII slug candidate from a display value.
pub fn slugify(value: &str, max_length: usize) -> String {
    let mut output = String::new();
    let mut separator = false;
    for character in value.nfkd().flat_map(char::to_lowercase) {
        if character.is_ascii_alphanumeric() {
            let needs_separator = separator && !output.is_empty();
            let required_length = usize::from(needs_separator) + 1;
            if output.len().saturating_add(required_length) > max_length {
                break;
            }
            if needs_separator {
                output.push('-');
            }
            output.push(character);
            separator = false;
        } else if !output.is_empty() {
            separator = true;
        }
    }
    output
}

/// Append a numeric collision suffix while preserving the maximum length.
pub fn with_numeric_suffix(base: &str, number: u64, max_length: usize) -> String {
    let suffix = format!("-{number}");
    let stem_length = max_length.saturating_sub(suffix.len());
    let stem = base.get(..base.len().min(stem_length)).unwrap_or_default();
    format!("{}{suffix}", stem.trim_end_matches('-'))
}

fn validate(value: &str, max_length: usize) -> Result<(), SlugError> {
    let valid = (1..=max_length).contains(&value.len())
        && value
            .bytes()
            .all(|byte| is_slug_alphanumeric(byte) || byte == b'-')
        && value
            .as_bytes()
            .first()
            .is_some_and(|byte| is_slug_alphanumeric(*byte))
        && value
            .as_bytes()
            .last()
            .is_some_and(|byte| is_slug_alphanumeric(*byte))
        && !value.contains("--")
        && Uuid::parse_str(value).is_err();
    valid.then_some(()).ok_or(SlugError)
}

fn is_slug_alphanumeric(byte: u8) -> bool {
    byte.is_ascii_lowercase() || byte.is_ascii_digit()
}
