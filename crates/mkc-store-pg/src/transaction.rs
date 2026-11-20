//! One transaction attempt preserving query errors and caller-owned rollbacks.

use diesel::PgConnection;
use diesel::result::Error as DieselError;
use mkc_store_interface::error::{Error, Result};
use mkc_store_interface::store::{Decision, Transaction};

use crate::queries::PgQueries;
use crate::retry::Attempt;

/// Serializable for writes, READ COMMITTED read-only for reads. A
/// `Decision::Rollback` commits nothing and is not an error; a query error
/// rolls back and is returned with its source intact.
pub(crate) struct DatabaseAttempt<'a> {
    pub(crate) connection: &'a mut PgConnection,
    pub(crate) work: &'a mut dyn Transaction,
    pub(crate) read_only: bool,
}

impl Attempt for DatabaseAttempt<'_> {
    fn run(&mut self) -> Result<()> {
        let mut callback_error = None;
        let mut rejected = false;
        let transaction = self.connection.build_transaction();
        let mut transaction = if self.read_only {
            transaction.read_committed().read_only()
        } else {
            transaction.serializable()
        };
        let result = transaction.run::<_, DieselError, _>(|connection| {
            match self.work.run(&mut PgQueries { connection }) {
                Ok(Decision::Commit) => Ok(()),
                Ok(Decision::Rollback) => {
                    rejected = true;
                    Err(DieselError::RollbackTransaction)
                }
                Err(error) => {
                    callback_error = Some(error);
                    Err(DieselError::RollbackTransaction)
                }
            }
        });
        match (result, callback_error) {
            (Ok(()), _) => Ok(()),
            (_, Some(error)) => Err(error),
            (Err(DieselError::RollbackTransaction), None) if rejected => Ok(()),
            (Err(error), None) => Err(Error::internal_with(error, "commit platform transaction")),
        }
    }
}
