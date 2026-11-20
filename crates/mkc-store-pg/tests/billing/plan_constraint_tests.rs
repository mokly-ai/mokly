//! Organization plan constraint acceptance and rejection scenarios.

use diesel::prelude::*;
use mkc_domain::values::Plan;
use mkc_store_interface::error::Error;
use mkc_store_interface::store::Callback;
use uuid::Uuid;

use super::support;

#[test]
fn team_plan_is_accepted_and_round_trips() {
    support::run(&mut |queries| {
        let organization = support::organization("Team plan", Plan::Team);
        queries.insert_organization(&organization)?;
        assert_eq!(
            queries.organization(organization.id)?.unwrap().plan,
            Plan::Team
        );
        Ok(())
    });
}

#[test]
fn unknown_plan_is_a_typed_internal_constraint_failure() {
    let Some(database) = support::database() else {
        return;
    };
    let mut connection = database.connection();
    let id = Uuid::now_v7();
    let suffix = id.simple();
    let function = format!("billing_unknown_plan_{suffix}");
    let trigger = format!("billing_unknown_plan_trigger_{suffix}");
    diesel::sql_query(format!(
        "CREATE FUNCTION {function}() RETURNS trigger LANGUAGE plpgsql AS $$
         BEGIN NEW.plan := 'enterprise'; RETURN NEW; END $$"
    ))
    .execute(&mut connection)
    .unwrap();
    diesel::sql_query(format!(
        "CREATE TRIGGER {trigger} BEFORE INSERT ON organizations
         FOR EACH ROW WHEN (NEW.id = '{id}'::uuid)
         EXECUTE FUNCTION {function}()"
    ))
    .execute(&mut connection)
    .unwrap();

    let mut organization = support::organization("Unknown plan", Plan::Free);
    organization.id = id.into();
    let result = database.store.transaction(&mut Callback(&mut |queries| {
        queries.insert_organization(&organization)
    }));

    diesel::sql_query(format!("DROP TRIGGER {trigger} ON organizations"))
        .execute(&mut connection)
        .unwrap();
    diesel::sql_query(format!("DROP FUNCTION {function}()"))
        .execute(&mut connection)
        .unwrap();
    assert!(matches!(result, Err(Error::Internal(_))));
}
