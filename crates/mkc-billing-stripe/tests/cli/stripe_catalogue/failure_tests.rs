//! Archive input refusals and actionable provider failure lines.

use super::super::stripe_catalogue_double::{CATALOGUE_KEY, StripeDouble};
use super::{assert_failure, assert_failure_output, run_archive, run_cli, run_sync, unix_now};

#[test]
fn wrong_key_kind_fails_before_any_sync_or_archive_request() {
    let stripe = StripeDouble::start();
    let failure = "error wrong-key-kind variable=MKC_STRIPE_CATALOGUE_KEY expected=restricted\n";
    assert_failure(
        run_sync(&stripe, "sk_test_fixture_catalogue", true, "main-preview"),
        failure,
    );
    assert_failure(
        run_archive(&stripe, "sk_test_fixture_catalogue", true, "main-preview"),
        failure,
    );
    assert_eq!(stripe.request_count(), 0);
    stripe.assert_clean();
}

#[test]
fn archive_wrong_key_mode_fails_before_any_request() {
    let stripe = StripeDouble::start();
    assert_failure(
        run_archive(&stripe, CATALOGUE_KEY, true, "production"),
        "error wrong-key-mode environment=production expected=live\n",
    );
    assert_eq!(stripe.request_count(), 0);
    stripe.assert_clean();
}

#[test]
fn archive_missing_key_fails_before_any_request() {
    let stripe = StripeDouble::start();
    let output = run_cli(
        Some(stripe.origin()),
        None,
        &["archive", "--environment", "main-preview"],
    );
    assert_failure(
        output,
        "error missing-key variable=MKC_STRIPE_CATALOGUE_KEY\n",
    );
    assert_eq!(stripe.request_count(), 0);
    stripe.assert_clean();
}

#[test]
fn archive_reports_missing_current_price_on_an_empty_price_account() {
    let stripe = StripeDouble::start();
    stripe.seed_product_only();
    assert_failure(
        run_archive(&stripe, CATALOGUE_KEY, false, "main-preview"),
        "error missing-current-price lookup_key=mokly_team_editor_usd_month\n",
    );
    stripe.assert_clean();
}

#[test]
fn permission_denied_write_includes_reason_type_and_code() {
    let stripe = StripeDouble::start();
    stripe.seed_catalogue("price_editor", 2_000);
    stripe.set_price_created("price_editor", unix_now() - 25 * 60 * 60);
    stripe.seed_keyless_editor("price_editor_unlinked");
    stripe.queue_permission_denied();
    assert_failure_output(
        run_archive(&stripe, CATALOGUE_KEY, true, "main-preview"),
        "price mokly_team_editor_usd_month current price_editor\n",
        concat!(
            "error provider-refused operation=price-archive target=price_editor_unlinked ",
            "reason=permission-denied type=invalid_request_error code=permission_denied\n",
        ),
    );
    assert!(stripe.price_active("price_editor_unlinked"));
    stripe.assert_clean();
}
