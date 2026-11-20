//! Sync creation, run-scoped idempotency, and product reactivation scenarios.

use super::super::stripe_catalogue_double::{CATALOGUE_KEY, StripeDouble};
use super::{
    CHECK_OUTPUT, assert_failure_output, assert_success, assert_write_run, run_cli, run_from_call,
    run_sync, unix_now,
};

#[test]
fn empty_account_dry_run_apply_and_second_apply_converge() {
    let stripe = StripeDouble::start();
    assert_success(
        run_sync(&stripe, CATALOGUE_KEY, false, "main-preview"),
        concat!(
            "product mokly_team would create\n",
            "price mokly_team_editor_usd_month would create\n",
            "price mokly_team_collaborator_usd_month would create\n",
        ),
    );
    assert_eq!(stripe.write_count(), 0);
    assert_success(
        run_sync(&stripe, CATALOGUE_KEY, true, "main-preview"),
        concat!(
            "product mokly_team created prod_created_1\n",
            "price mokly_team_editor_usd_month created price_created_1\n",
            "price mokly_team_collaborator_usd_month created price_created_2\n",
        ),
    );
    assert_eq!(stripe.write_count(), 3);
    let first_run = assert_write_run(&stripe.calls());
    assert_success(
        run_sync(&stripe, CATALOGUE_KEY, true, "main-preview"),
        concat!(
            "product mokly_team validated prod_created_1\n",
            "price mokly_team_editor_usd_month validated price_created_1\n",
            "price mokly_team_collaborator_usd_month validated price_created_2\n",
        ),
    );
    assert_eq!(stripe.write_count(), 3);

    let second = StripeDouble::start();
    assert_success(
        run_sync(&second, CATALOGUE_KEY, true, "main-preview"),
        concat!(
            "product mokly_team created prod_created_1\n",
            "price mokly_team_editor_usd_month created price_created_1\n",
            "price mokly_team_collaborator_usd_month created price_created_2\n",
        ),
    );
    assert_ne!(first_run, assert_write_run(&second.calls()));
    second.assert_clean();
    stripe.assert_clean();
}

#[test]
fn cached_server_error_does_not_pin_a_later_invocation() {
    let stripe = StripeDouble::start();
    stripe.seed_catalogue("price_editor_old", 1_999);
    stripe.set_next_price_created(unix_now());
    stripe.queue_server_error();
    assert_failure_output(
        run_sync(&stripe, CATALOGUE_KEY, true, "main-preview"),
        "product mokly_team validated prod_team\n",
        "error provider-unavailable operation=price-replace target=price_editor_old\n",
    );
    let first_write = stripe
        .calls()
        .into_iter()
        .find(|call| call.method == "POST")
        .unwrap();
    let first_run = run_from_call(&first_write);
    assert!(stripe.price_active("price_editor_old"));

    assert_success(
        run_sync(&stripe, CATALOGUE_KEY, true, "main-preview"),
        concat!(
            "product mokly_team validated prod_team\n",
            "price mokly_team_editor_usd_month replaced price_editor_old -> price_created_1\n",
            "price mokly_team_collaborator_usd_month validated price_collaborator\n",
        ),
    );
    let writes = stripe
        .calls()
        .into_iter()
        .filter(|call| call.method == "POST")
        .collect::<Vec<_>>();
    assert_eq!(writes.len(), 2);
    assert_ne!(first_run, run_from_call(&writes[1]));
    assert!(
        writes[1]
            .body
            .contains("metadata%5Bmokly_replaces%5D=price_editor_old")
    );
    stripe.assert_clean();
}

#[test]
fn drifted_predecessor_is_repaired_before_replacement() {
    let stripe = StripeDouble::start();
    stripe.seed_catalogue_without_editor_tag("price_editor_old", 1_999);
    assert_success(
        run_sync(&stripe, CATALOGUE_KEY, false, "main-preview"),
        concat!(
            "product mokly_team validated prod_team\n",
            "price mokly_team_editor_usd_month would update price_editor_old\n",
            "price mokly_team_editor_usd_month would replace price_editor_old -> pending\n",
            "price mokly_team_collaborator_usd_month validated price_collaborator\n",
        ),
    );
    assert_eq!(stripe.write_count(), 0);

    assert_success(
        run_sync(&stripe, CATALOGUE_KEY, true, "main-preview"),
        concat!(
            "product mokly_team validated prod_team\n",
            "price mokly_team_editor_usd_month updated price_editor_old\n",
            "price mokly_team_editor_usd_month replaced price_editor_old -> price_created_1\n",
            "price mokly_team_collaborator_usd_month validated price_collaborator\n",
        ),
    );
    let predecessor = stripe.price("price_editor_old");
    assert_eq!(predecessor["metadata"]["mokly_seat_kind"], "editor");
    assert_eq!(predecessor["active"], true);
    assert!(predecessor["lookup_key"].is_null());
    stripe.assert_clean();
}

#[test]
fn archived_product_is_reactivated_on_a_later_sync() {
    let stripe = StripeDouble::start();
    assert_success(
        run_sync(&stripe, CATALOGUE_KEY, true, "main-preview"),
        concat!(
            "product mokly_team created prod_created_1\n",
            "price mokly_team_editor_usd_month created price_created_1\n",
            "price mokly_team_collaborator_usd_month created price_created_2\n",
        ),
    );
    stripe.archive_product();
    assert!(!stripe.product_active());
    assert_success(
        run_sync(&stripe, CATALOGUE_KEY, true, "main-preview"),
        concat!(
            "product mokly_team updated prod_created_1\n",
            "price mokly_team_editor_usd_month validated price_created_1\n",
            "price mokly_team_collaborator_usd_month validated price_created_2\n",
        ),
    );
    assert!(stripe.product_active());
    stripe.assert_clean();
}

#[test]
fn offline_check_is_exact_and_needs_neither_key_nor_git_checkout() {
    assert_success(run_cli(None, None, &["check"]), CHECK_OUTPUT);
}

#[test]
fn unknown_environment_is_a_clap_usage_error() {
    let output = run_cli(None, None, &["archive", "--environment", "staging"]);
    assert!(!output.status.success());
    assert!(String::from_utf8_lossy(&output.stdout).is_empty());
    assert!(String::from_utf8_lossy(&output.stderr).contains("invalid value 'staging'"));
}
