//! Cache identities include effective checkout settings and attribute overrides.

use std::fmt;
use std::sync::Mutex;

use sha2::{Digest, Sha256};

use crate::command::{DEFAULT_OUTPUT_LIMIT, ProcessMode};
use crate::error::{IoResult, Result};
use crate::identity::ObjectId;
use crate::repository::GitRepository;
use crate::tree::Limits;

/// Effective conversion settings for one pinned commit, without a preparation salt.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CheckoutIdentity {
    /// Digest of the commit, effective Git configuration, and file attributes.
    pub digest: String,
    /// A filter attribute makes converted bytes private to one preparation.
    pub filtered: bool,
}

/// The tree listing of one commit after its object check passed. An equal later listing
/// names the same objects, so it needs no second object check. The configuration and the
/// attributes are read again for each identity.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = KeptListingMock))]
pub trait KeptListing: Send + Sync {
    /// Whether `listing` equals the kept listing of `commit`.
    fn matches(&self, commit: &ObjectId, listing: &[u8]) -> bool;
    /// Keep the checked `listing` of `commit` in place of any earlier listing.
    fn keep(&self, commit: &ObjectId, listing: &[u8]);
}

impl fmt::Debug for dyn KeptListing + '_ {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("KeptListing")
    }
}

/// One kept listing in process memory, as the SHA-256 digest of its bytes, so that its
/// charge does not grow with the tree.
#[derive(Default)]
pub struct MemoryKeptListing {
    slot: Mutex<Option<(ObjectId, [u8; 32])>>,
}

impl KeptListing for MemoryKeptListing {
    fn matches(&self, commit: &ObjectId, listing: &[u8]) -> bool {
        let digest: [u8; 32] = Sha256::digest(listing).into();
        self.slot
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .as_ref()
            .is_some_and(|(kept, kept_digest)| kept == commit && *kept_digest == digest)
    }

    fn keep(&self, commit: &ObjectId, listing: &[u8]) {
        let digest: [u8; 32] = Sha256::digest(listing).into();
        *self.slot.lock().unwrap_or_else(|error| error.into_inner()) =
            Some((commit.clone(), digest));
    }
}

struct CheckoutSettings {
    hash: Sha256,
    filtered: bool,
}

impl GitRepository {
    fn checkout_settings(
        &self,
        commit: &ObjectId,
        kept: Option<&dyn KeptListing>,
    ) -> Result<CheckoutSettings> {
        let config = self.command_with_mode(
            ProcessMode::PlainGroup,
            &["config", "--null", "--list", "--includes"],
            vec![],
            DEFAULT_OUTPUT_LIMIT,
        )?;
        let entries = self.listing(commit, None, Limits::default(), kept)?;
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

    pub(crate) fn checkout_settings_identity(
        &self,
        commit: &ObjectId,
        kept: Option<&dyn KeptListing>,
    ) -> Result<CheckoutIdentity> {
        let settings = self.checkout_settings(commit, kept)?;
        Ok(CheckoutIdentity {
            digest: hex(settings.hash),
            filtered: settings.filtered,
        })
    }

    pub(crate) fn checkout_key(&self, commit: &ObjectId) -> Result<String> {
        let CheckoutSettings { mut hash, filtered } = self.checkout_settings(commit, None)?;
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
#[path = "_tests_/kept_listing_tests.rs"]
mod kept_listing_tests;
