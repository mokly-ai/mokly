//! Validated values used to construct direct process arguments.

use mkc_domain::ids::ProjectId;
use mkc_domain::validation;
use url::Url;

use crate::error::{Error, RequestField, Result};

macro_rules! input {
    ($name:ident, $field:ident, $doc:literal, $valid:expr) => {
        #[doc = $doc]
        #[derive(Clone, Debug, Eq, PartialEq)]
        pub struct $name(String);

        impl $name {
            /// Validate the value without including it in a failure.
            pub fn new(value: impl Into<String>) -> Result<Self> {
                let value = value.into();
                if !($valid)(&value) {
                    return Err(Error::InvalidRequest {
                        field: RequestField::$field,
                    });
                }
                Ok(Self(value))
            }

            /// Borrow the validated argument value.
            pub fn as_str(&self) -> &str {
                &self.0
            }
        }
    };
}

input!(
    Repository,
    Repository,
    "Canonical GitHub owner/name.",
    validation::repository
);
input!(
    HeadSha,
    HeadSha,
    "Full lowercase Git SHA-1 or SHA-256.",
    |value: &str| {
        matches!(value.len(), 40 | 64)
            && value
                .bytes()
                .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    }
);
input!(
    Branch,
    Branch,
    "A Git branch name safe for direct checkout and refspecs.",
    valid_branch
);
input!(
    ConfigPath,
    ConfigPath,
    "A safe repository-relative JSON config path.",
    |value: &str| { validation::config_path(value) && !value.starts_with('-') }
);

fn valid_branch(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 255
        && !value.starts_with('-')
        && value != "@"
        && !value.contains("..")
        && !value.contains("@{")
        && !value
            .bytes()
            .any(|byte| byte <= b' ' || byte == 127 || b"~^:?*[\\".contains(&byte))
        && value.split('/').all(|part| {
            !part.is_empty()
                && !part.starts_with('.')
                && !part.ends_with('.')
                && !part.ends_with(".lock")
        })
}

/// Validated project upload URL with no userinfo, query or fragment.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UploadEndpoint(Url);

impl UploadEndpoint {
    /// Parse the exact upload-exchange admission URL for this project.
    pub fn new(value: &str, project: ProjectId) -> Result<Self> {
        let Ok(url) = Url::parse(value) else {
            return Err(Error::InvalidRequest {
                field: RequestField::UploadEndpoint,
            });
        };
        if !matches!(url.scheme(), "http" | "https")
            || !url.has_host()
            || !url.username().is_empty()
            || url.password().is_some()
            || url.query().is_some()
            || url.fragment().is_some()
            || url.path() != format!("/v1/projects/{project}/publications")
        {
            return Err(Error::InvalidRequest {
                field: RequestField::UploadEndpoint,
            });
        }
        Ok(Self(url))
    }

    /// Borrow the URL only for the publish environment.
    pub fn as_str(&self) -> &str {
        self.0.as_str()
    }
}

#[cfg(test)]
#[path = "_tests_/input_tests.rs"]
mod input_tests;
