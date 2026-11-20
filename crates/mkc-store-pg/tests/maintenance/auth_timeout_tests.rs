//! A blocked auth delete honors its transaction-local statement allowance.

use std::time::Duration;

use chrono::Utc;
use diesel::RunQueryDsl;
use diesel::result::Error;
use mkc_store_interface::auth_prune::PruneBatch;
use mkc_store_interface::error;
use mkc_store_interface::store::Callback;

use super::fixtures::database;

#[test]
fn auth_delete_cancels_a_lock_wait_at_its_statement_timeout() {
    let Some(mut db) = database() else { return };
    diesel::sql_query("BEGIN")
        .execute(&mut db.connection)
        .unwrap();
    diesel::sql_query("LOCK TABLE magic_links IN ACCESS EXCLUSIVE MODE")
        .execute(&mut db.connection)
        .unwrap();
    let outcome = db.store.transaction(&mut Callback(&mut |queries| {
        queries.prune_magic_links(
            Utc::now(),
            PruneBatch {
                limit: 1,
                timeout: Duration::from_millis(1),
            },
        )?;
        Ok(())
    }));
    diesel::sql_query("ROLLBACK")
        .execute(&mut db.connection)
        .unwrap();
    let error::Error::Internal(error) = outcome.unwrap_err() else {
        panic!("expected a stored database cancellation error");
    };
    let database_error = error
        .source_chain()
        .find_map(|source| source.downcast_ref::<Error>());
    let Some(Error::DatabaseError(_, info)) = database_error else {
        panic!("database error missing from source chain: {error}");
    };
    assert_eq!(
        info.message(),
        "canceling statement due to statement timeout"
    );
}
