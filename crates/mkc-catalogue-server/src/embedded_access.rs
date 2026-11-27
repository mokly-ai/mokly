//! Credential forwarding and indexed file delivery for private frame access.

use mkc_domain::ids::PublicationId;
use mkc_publications::access::CatalogueContext;
use mkc_publications::error;

use crate::catalogue::{FileLookup, PublishedCatalogue, Request, Served};
use crate::error::{Error, Result};
use crate::file_response;
use crate::routes::{ACCESS_START_PATH, ACCESS_WORKER_PATH};

impl Request {
    /// Read the catalogue cookie only when the access policy needs it.
    pub(crate) fn catalogue_cookie(&self) -> Option<&str> {
        self.cookie_header
            .as_ref()?
            .to_str()
            .ok()?
            .split(';')
            .find_map(|cookie| cookie.trim().strip_prefix("__Host-mkc_catalogue="))
    }
}

impl PublishedCatalogue {
    /// Pass the bearer and a lazy cookie read to the access service.
    pub(crate) fn authorize_request(
        &self,
        publication: PublicationId,
        request: &Request,
        clear_cookie: &mut bool,
    ) -> error::Result<CatalogueContext> {
        self.access.authorize(
            publication,
            request.bearer.as_deref(),
            &mut || request.catalogue_cookie(),
            clear_cookie,
        )
    }

    /// Resolve only the start page or an exact public Mokly file after a 401.
    pub(crate) fn serve_access_file(
        &self,
        publication: PublicationId,
        request: &Request,
    ) -> Result<Served> {
        let (path, status) = if request.iframe_navigation {
            (ACCESS_START_PATH, 401)
        } else {
            match request.path.strip_prefix('/') {
                Some(path @ (ACCESS_START_PATH | ACCESS_WORKER_PATH)) => (path, 200),
                _ => return Err(Error::Unauthorized),
            }
        };
        let mut file = self.lookup(publication, path)?.ok_or(Error::Unauthorized)?;
        if request.iframe_navigation {
            file.content_type = "text/html; charset=utf-8".into();
        }
        file_response::select(request, file, status, "no-store")
    }
}
