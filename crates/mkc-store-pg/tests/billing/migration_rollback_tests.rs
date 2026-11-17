//! Billing review migration rollback preserves terminal conflict deliveries.

use diesel::connection::SimpleConnection;
use diesel::sql_types::Text;
use diesel::{Connection, PgConnection, RunQueryDsl};
use mkc_db::migration::{DieselMigrations, MigrationRunner};
use mkc_test_pg::scratch_schema::ScratchSchema;

const REVIEW_FIX_DOWN: &str =
    include_str!("../../../mkc-db/migrations/202609281201_billing_review_fixes/down.sql");
const REVIEW_FIX_UP: &str =
    include_str!("../../../mkc-db/migrations/202609281201_billing_review_fixes/up.sql");
const COMMANDS_DOWN: &str =
    include_str!("../../../mkc-db/migrations/202609281203_billing_commands/down.sql");
const COMMANDS_UP: &str =
    include_str!("../../../mkc-db/migrations/202609281203_billing_commands/up.sql");

#[derive(diesel::QueryableByName)]
struct StoredFailure {
    #[diesel(sql_type = Text)]
    last_failure: String,
}

#[test]
fn conflict_delivery_survives_review_fix_rollback_and_reapply() {
    let Some(schema) = ScratchSchema::create("billing_rollback") else {
        return;
    };
    DieselMigrations.migrate(schema.scoped_url()).unwrap();
    let mut connection = PgConnection::establish(schema.scoped_url()).unwrap();
    connection
        .batch_execute(
            "INSERT INTO billing_deliveries
             (id, event, body, received_at, due_at, attempts, status, last_failure)
             VALUES
             ('evt_rollback', 'customer.subscription.updated', ''::bytea,
              now(), now(), 1, 'failed', 'conflict')",
        )
        .unwrap();

    connection.batch_execute(COMMANDS_DOWN).unwrap();
    connection.batch_execute(REVIEW_FIX_DOWN).unwrap();
    assert_eq!(failure(&mut connection), "internal");
    connection.batch_execute(REVIEW_FIX_UP).unwrap();
    connection.batch_execute(COMMANDS_UP).unwrap();
    assert_eq!(failure(&mut connection), "internal");
}

fn failure(connection: &mut PgConnection) -> String {
    diesel::sql_query("SELECT last_failure FROM billing_deliveries WHERE id = 'evt_rollback'")
        .get_result::<StoredFailure>(connection)
        .unwrap()
        .last_failure
}
