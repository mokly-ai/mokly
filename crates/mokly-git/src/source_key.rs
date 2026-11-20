//! Cache identities include effective checkout settings and attribute overrides.

use sha2::{Digest, Sha256};

use crate::command::{DEFAULT_OUTPUT_LIMIT, ProcessMode};
use crate::error::{IoResult, Result};
use crate::identity::ObjectId;
use crate::repository::GitRepository;

/// Effective conversion settings for one pinned commit, without a preparation salt.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CheckoutIdentity {
    /// Digest of the commit, effective Git configuration, and file attributes.
    pub digest: String,
    /// A filter attribute makes converted bytes private to one preparation.
    pub filtered: bool,
}

struct CheckoutSettings {
    hash: Sha256,
    filtered: bool,
}

impl GitRepository {
    fn checkout_settings(&self, commit: &ObjectId) -> Result<CheckoutSettings> {
        let config = self.command_with_mode(
            ProcessMode::PlainGroup,
            &["config", "--null", "--list", "--includes"],
            vec![],
            DEFAULT_OUTPUT_LIMIT,
        )?;
        let entries = self.settings_listing(commit)?;
        let mut input = Vec::new();
        for entry in entries.iter().filter(|entry| entry.mode.regular()) {
            input.extend_from_slice(entry.path.as_str().as_bytes());
            input.push(0);
        }
        let attributes = self.command_with_mode(
            ProcessMode::PlainGroup,
            &[
                &format!("--attr-source={commit}"),
                "check-attr",
                "--all",
                "-z",
                "--stdin",
            ],
            input,
            DEFAULT_OUTPUT_LIMIT,
        )?;
        let mut hash = Sha256::new();
        hash.update(b"mokly-checkout-sources-v3\0");
        hash.update(commit.as_str().as_bytes());
        hash.update(config);
        hash.update(&attributes);
        let filtered = attributes
            .split(|byte| *byte == 0)
            .enumerate()
            .any(|(index, field)| index % 3 == 1 && field == b"filter");
        Ok(CheckoutSettings { hash, filtered })
    }

    pub(crate) fn checkout_settings_identity(&self, commit: &ObjectId) -> Result<CheckoutIdentity> {
        let settings = self.checkout_settings(commit)?;
        Ok(CheckoutIdentity {
            digest: hex(settings.hash),
            filtered: settings.filtered,
        })
    }

    pub(crate) fn checkout_key(&self, commit: &ObjectId) -> Result<String> {
        let CheckoutSettings { mut hash, filtered } = self.checkout_settings(commit)?;
        if filtered {
            let salt = tempfile::Builder::new()
                .prefix("mokly-filter-generation-")
                .tempdir()
                .git()?;
            hash.update(salt.path().as_os_str().as_encoded_bytes());
        }
        Ok(hex(hash))
    }
}

fn hex(hash: Sha256) -> String {
    hash.finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

#[cfg(test)]
#[path = "_tests_/source_key_tests.rs"]
mod source_key_tests;

#[cfg(test)]
#[path = "_tests_/settings_listing_tests.rs"]
mod settings_listing_tests;
