//! Installation scope and shared cursor parsing for the installation list.

use mkc_domain::ids::OrganizationId;
use url::form_urlencoded::{Serializer, parse};

use crate::error::{ApiError, Result};
use crate::pagination::Pagination;

pub(crate) struct InstallationsQuery {
    pub(crate) workspace_id: Option<OrganizationId>,
    pub(crate) page: Pagination,
}

impl InstallationsQuery {
    pub(crate) fn parse(query: &str) -> Result<Self> {
        let mut workspace_id = None;
        let mut page = Serializer::new(String::new());
        for (key, value) in parse(query.as_bytes()) {
            if key == "workspaceId" {
                if workspace_id.is_some() {
                    return Err(ApiError::ValidationFailed);
                }
                workspace_id = Some(OrganizationId(match value.parse() {
                    Ok(id) => id,
                    Err(_) => return Err(ApiError::ValidationFailed),
                }));
            } else {
                page.append_pair(&key, &value);
            }
        }
        Ok(Self {
            workspace_id,
            page: Pagination::parse(&page.finish())?,
        })
    }
}
