//! Bounded seed catalogue reads checked against the request before token creation.

use std::io::Cursor;
use std::sync::Arc;

use mkc_file_store_interface::seed::SeedStore;
use mkc_file_store_interface::seed_name::SeedName;
use mkc_mokly_contract::archive::TarballReader;
use mkc_mokly_contract::bundle::ENVELOPE_PATH;
use mkc_mokly_contract::limits::Limits;
use mkc_mokly_contract::manifest::UploadManifest;

use super::error::{Error, ErrorResultExt, Failure, Result, require};

#[cfg_attr(test, unimock::unimock(api = SeedCatalogueMock))]
pub(super) trait SeedCatalogue: Send + Sync {
    fn read(&self, run: &str, revision: &str) -> Result<Vec<u8>>;
}

pub(super) struct StoredSeedCatalogue {
    pub(super) files: Arc<dyn SeedStore>,
    pub(super) reader: Arc<dyn TarballReader>,
}

impl SeedCatalogue for StoredSeedCatalogue {
    fn read(&self, run: &str, revision: &str) -> Result<Vec<u8>> {
        let name =
            SeedName::new(run, "catalogue/plan.tar.gz").context("validate seed plan name")?;
        let bytes = self
            .files
            .get(&name, name.max_bytes())
            .context("read seed catalogue")?
            .ok_or_else(|| Error::internal(Failure::CatalogueMissing))?;
        let scanned = self
            .reader
            .read(&mut Cursor::new(&bytes), Limits::default())
            .context("read seed plan archive")?;
        let envelope = scanned
            .files()
            .get(ENVELOPE_PATH)
            .ok_or_else(|| Error::internal(Failure::EnvelopeMissing))?;
        let manifest = UploadManifest::parse(envelope, Limits::default())
            .context("parse seed plan envelope")?;
        require("catalogue headSha", revision, manifest.head_sha.as_str())?;
        Ok(bytes)
    }
}
