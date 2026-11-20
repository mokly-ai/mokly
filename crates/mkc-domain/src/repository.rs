//! Portable repository identities shared by project creation and publication ingest.

/// A validated Git host, slash-separated owner and repository name.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RepositoryIdentity {
    host: String,
    owner: String,
    name: String,
}

impl RepositoryIdentity {
    /// Parse a CLI identity; two segments use GitHub as their host.
    pub fn parse(value: &str) -> Option<Self> {
        let parts: Vec<_> = value.split('/').collect();
        match parts.as_slice() {
            [owner, name] => Self::from_parts("github.com", owner, without_git_suffix(name)),
            [host, rest @ ..] if rest.len() >= 2 => {
                let (name, owners) = rest.split_last()?;
                Self::from_parts(host, &owners.join("/"), without_git_suffix(name))
            }
            _ => None,
        }
    }

    /// Validate an upload envelope's separate identity fields.
    pub fn from_parts(host: &str, owner: &str, name: &str) -> Option<Self> {
        if !valid_host(host)
            || owner.len() > 255
            || name.len() > 255
            || !owner.split('/').all(valid_segment)
            || !valid_segment(name)
            || (host == "github.com" && owner.contains('/'))
        {
            return None;
        }
        Some(Self {
            host: host.to_owned(),
            owner: owner.to_ascii_lowercase(),
            name: name.to_ascii_lowercase(),
        })
    }

    /// Return the canonical stored identity, omitting GitHub's default host.
    pub fn canonical(&self) -> String {
        if self.host == "github.com" {
            format!("{}/{}", self.owner, self.name)
        } else {
            format!("{}/{}/{}", self.host, self.owner, self.name)
        }
    }
}

fn without_git_suffix(name: &str) -> &str {
    name.strip_suffix(".git").unwrap_or(name)
}

fn valid_segment(value: &str) -> bool {
    !matches!(value, "" | "." | "..")
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b"._-".contains(&byte))
}

fn valid_host(host: &str) -> bool {
    if host.is_empty() || host.len() > 253 {
        return false;
    }
    host.split('.').all(|label| {
        !label.is_empty()
            && label.len() <= 63
            && !label.starts_with('-')
            && !label.ends_with('-')
            && label
                .bytes()
                .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
    })
}

#[cfg(test)]
#[path = "_tests_/repository_tests.rs"]
mod repository_tests;
