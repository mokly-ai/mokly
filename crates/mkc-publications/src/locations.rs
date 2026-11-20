//! Pure canonical publication and branch URLs.

use mkc_domain::app_paths;
use mkc_domain::blob::BlobHash;
use mkc_domain::ids::{ProjectId, PublicationId};
use mkc_domain::slug::{ProjectSlug, WorkspaceSlug};
use url::Url;

use crate::error::{ErrorResultExt, Result};

/// Validated origin configuration supplied by the composition root.
#[derive(Clone, Debug)]
pub struct Locations {
    /// App origin used by Changes links.
    pub app_origin: String,
    /// Wildcard catalogue DNS suffix, without a port.
    pub catalogue_domain: String,
    /// `https` in production; explicit `http` for loopback development.
    pub catalogue_scheme: String,
    /// Optional local listener port.
    pub catalogue_port: Option<u16>,
}

impl Locations {
    /// Canonical per-publication host authority.
    pub fn authority(&self, publication: PublicationId) -> String {
        let host = format!("p-{publication}.{}", self.catalogue_domain);
        match self.catalogue_port {
            Some(port) => format!("{host}:{port}"),
            None => host,
        }
    }

    /// Sandbox origin where this immutable catalogue can be served.
    pub fn catalogue(&self, publication: PublicationId) -> String {
        format!(
            "{}://{}",
            self.catalogue_scheme,
            self.authority(publication)
        )
    }

    /// App Changes URL, encoding producer-owned selection values once.
    pub fn viewer(
        &self,
        organization: &WorkspaceSlug,
        project: &ProjectSlug,
        publication: PublicationId,
        screen: Option<&str>,
    ) -> Result<String> {
        let path = app_paths::publication(organization, project, publication);
        let mut url = Url::parse(&app_paths::on_origin(&self.app_origin, &path))
            .context("construct publication viewer link")?;
        url.query_pairs_mut().append_pair("view", "changes");
        if let Some(screen) = screen {
            url.query_pairs_mut().append_pair("catalogueScreen", screen);
        }
        Ok(url.into())
    }
}

/// Stable DNS-safe branch identity; branch punctuation never enters a host.
pub fn branch_alias(project: ProjectId, branch: &str) -> String {
    let digest = BlobHash::digest(format!("{project}\0{branch}").as_bytes());
    format!("b-{}", &digest.as_str()[..40])
}
