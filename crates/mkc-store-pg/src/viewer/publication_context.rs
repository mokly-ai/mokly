//! Typed mapping of publication rows and optional retained provider context.

use diesel::prelude::*;
use diesel::sql_types::{BigInt, Nullable, Text};
use mkc_store_interface::error::{Error, Result};
use mkc_store_interface::viewer::{PublicationPullRequest, ViewerPublication};

use crate::publication_row::{InvalidRecord, PublicationRow};

#[derive(QueryableByName)]
pub(super) struct Row {
    #[diesel(embed)]
    publication: PublicationRow,
    #[diesel(sql_type = Nullable<BigInt>)]
    origin_number: Option<i64>,
    #[diesel(sql_type = Nullable<Text>)]
    origin_title: Option<String>,
    #[diesel(sql_type = Nullable<Text>)]
    origin_author: Option<String>,
    #[diesel(sql_type = Nullable<Text>)]
    origin_repository: Option<String>,
}

impl Row {
    pub(super) fn dto(self) -> Result<ViewerPublication> {
        let pull_request = match (
            self.origin_number,
            self.origin_title,
            self.origin_repository,
        ) {
            (Some(number), Some(title), Some(repository)) => Some(PublicationPullRequest {
                number,
                title,
                author: self.origin_author,
                repository,
            }),
            (None, None, None) if self.origin_author.is_none() => None,
            _ => return Err(Error::internal(InvalidRecord)),
        };
        Ok(ViewerPublication {
            publication: self.publication.dto()?,
            pull_request,
        })
    }
}
