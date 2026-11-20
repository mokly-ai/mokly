//! Stored pull request context for build and mixed-history reads.

use diesel::prelude::*;
use diesel::sql_types::{BigInt, Nullable, Text};
use mkc_store_interface::error::{Error, Result};
use mkc_store_interface::viewer::PublicationPullRequest;

use crate::publication_row::InvalidRecord;

#[derive(QueryableByName)]
pub(super) struct Context {
    #[diesel(sql_type = Nullable<BigInt>)]
    origin_number: Option<i64>,
    #[diesel(sql_type = Nullable<Text>)]
    origin_title: Option<String>,
    #[diesel(sql_type = Nullable<Text>)]
    origin_author: Option<String>,
    #[diesel(sql_type = Nullable<Text>)]
    origin_repository: Option<String>,
}

impl Context {
    pub(super) fn dto(self) -> Result<Option<PublicationPullRequest>> {
        match (
            self.origin_number,
            self.origin_title,
            self.origin_repository,
        ) {
            (Some(number), Some(title), Some(repository)) => Ok(Some(PublicationPullRequest {
                number,
                title,
                repository,
                author: self.origin_author,
            })),
            (None, None, None) if self.origin_author.is_none() => Ok(None),
            _ => Err(Error::internal(InvalidRecord)),
        }
    }
}
