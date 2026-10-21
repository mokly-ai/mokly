//! Cache identities include effective checkout settings and attribute overrides.

use sha2::{Digest, Sha256};

use crate::command::DEFAULT_OUTPUT_LIMIT;
use crate::error::{IoResult, Result};
use crate::identity::ObjectId;
use crate::repository::{GitRepository, Repository};
use crate::tree::Limits;

impl GitRepository {
    pub(crate) fn checkout_key(&self, commit: &ObjectId) -> Result<String> {
        let config = self.command(
            &["config", "--null", "--list", "--includes"],
            vec![],
            DEFAULT_OUTPUT_LIMIT,
        )?;
        let entries = self.list(commit, None, Limits::default())?;
        let mut input = Vec::new();
        for entry in entries.iter().filter(|entry| entry.mode.regular()) {
            input.extend_from_slice(entry.path.as_str().as_bytes());
            input.push(0);
        }
        let attributes = self.command(
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
        if attributes
            .split(|byte| *byte == 0)
            .collect::<Vec<_>>()
            .chunks_exact(3)
            .any(|record| record[1] == b"filter" && !matches!(record[2], b"unset" | b"unspecified"))
        {
            let salt = tempfile::Builder::new()
                .prefix("mokly-filter-generation-")
                .tempdir()
                .git()?;
            hash.update(salt.path().as_os_str().as_encoded_bytes());
        }
        Ok(hash
            .finalize()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect())
    }
}
