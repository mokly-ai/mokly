//! Replacement retention, chain traversal, and product-sweep CLI scenarios.

use super::super::stripe_catalogue_double::{CATALOGUE_KEY, StripeDouble};
use super::{assert_success, assert_write_run, rfc3339, run_archive, run_sync, unix_now};

#[test]
fn replacement_stays_active_until_archive_holds_then_archives_it() {
    let stripe = StripeDouble::start();
    stripe.seed_catalogue("price_editor_old", 1_999);
    let created = unix_now();
    stripe.set_next_price_created(created);
    assert_success(
        run_sync(&stripe, CATALOGUE_KEY, true, "main-preview"),
        concat!(
            "product mokly_team validated prod_team\n",
            "price mokly_team_editor_usd_month replaced price_editor_old -> price_created_1\n",
            "price mokly_team_collaborator_usd_month validated price_collaborator\n",
        ),
    );
    assert!(stripe.price_active("price_editor_old"));
    assert_eq!(stripe.write_count(), 1);
    let replacement = stripe
        .calls()
        .into_iter()
        .find(|call| call.method == "POST" && call.url == "/v1/prices")
        .unwrap();
    assert!(replacement.body.contains("transfer_lookup_key=true"));
    assert!(
        replacement
            .body
            .contains("metadata%5Bmokly_replaces%5D=price_editor_old")
    );

    assert_success(
        run_archive(&stripe, CATALOGUE_KEY, false, "main-preview"),
        &format!(
            concat!(
                "price mokly_team_editor_usd_month current price_created_1\n",
                "price mokly_team_editor_usd_month kept price_editor_old until {}\n",
                "price mokly_team_collaborator_usd_month current price_collaborator\n",
            ),
            rfc3339(created + 24 * 60 * 60)
        ),
    );
    assert!(stripe.price_active("price_editor_old"));

    stripe.set_price_created("price_created_1", unix_now() - 25 * 60 * 60);
    assert_success(
        run_archive(&stripe, CATALOGUE_KEY, true, "main-preview"),
        concat!(
            "price mokly_team_editor_usd_month current price_created_1\n",
            "price mokly_team_editor_usd_month archived price_editor_old\n",
            "price mokly_team_collaborator_usd_month current price_collaborator\n",
        ),
    );
    assert!(!stripe.price_active("price_editor_old"));
    assert_success(
        run_archive(&stripe, CATALOGUE_KEY, true, "main-preview"),
        concat!(
            "price mokly_team_editor_usd_month current price_created_1\n",
            "price mokly_team_collaborator_usd_month current price_collaborator\n",
        ),
    );
    stripe.assert_clean();
}

#[test]
fn replacement_chain_archives_oldest_price_on_another_product_without_metadata() {
    let stripe = StripeDouble::start();
    stripe.seed_cross_product_chain();
    assert_success(
        run_archive(&stripe, CATALOGUE_KEY, true, "main-preview"),
        concat!(
            "price mokly_team_editor_usd_month current price_editor_current\n",
            "price mokly_team_editor_usd_month archived price_editor_middle\n",
            "price mokly_team_editor_usd_month archived price_editor_oldest\n",
            "price mokly_team_collaborator_usd_month current price_collaborator\n",
        ),
    );
    assert!(!stripe.price_active("price_editor_middle"));
    assert!(!stripe.price_active("price_editor_oldest"));
    let _run = assert_write_run(&stripe.calls());
    stripe.assert_clean();
}

#[test]
fn unlinked_keyless_price_is_archived_by_the_product_sweep() {
    let stripe = StripeDouble::start();
    stripe.seed_catalogue("price_editor", 2_000);
    stripe.set_price_created("price_editor", unix_now() - 25 * 60 * 60);
    stripe.seed_keyless_editor("price_editor_unlinked");
    assert_success(
        run_archive(&stripe, CATALOGUE_KEY, true, "main-preview"),
        concat!(
            "price mokly_team_editor_usd_month current price_editor\n",
            "price mokly_team_editor_usd_month archived price_editor_unlinked\n",
            "price mokly_team_collaborator_usd_month current price_collaborator\n",
        ),
    );
    assert!(!stripe.price_active("price_editor_unlinked"));
    stripe.assert_clean();
}
