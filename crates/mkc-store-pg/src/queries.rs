//! Borrowed transaction connection; never escapes its transaction.

use diesel::PgConnection;
use mkc_store_interface::store::Queries;

pub(crate) struct PgQueries<'a> {
    pub(crate) connection: &'a mut PgConnection,
}

impl Queries for PgQueries<'_> {}
