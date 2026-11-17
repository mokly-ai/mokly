//! Typed provider-to-store subscription normalization and plan derivation.

use chrono::{DateTime, Utc};
use mkc_billing_interface::objects::{
    ExpandableInvoice, InvoiceStatus, Subscription, SubscriptionItem,
    SubscriptionStatus as ProviderStatus,
};
use mkc_domain::billing::{CATALOGUE, PRICE_SEAT_KIND_METADATA};
use mkc_domain::values::{Plan, SeatKind};
use mkc_store_interface::billing_state::SubscriptionStatus;
use mkc_store_interface::billing_subscription::BillingSubscriptionItem;

use crate::prices::VerifiedPriceIds;

use super::retry::AttemptError;

pub(super) struct NormalizedItem {
    pub(super) seat_kind: SeatKind,
    pub(super) provider_item_id: String,
    pub(super) price_id: String,
    pub(super) quantity: i32,
}

pub(super) struct NormalizedSubscription {
    pub(super) provider_subscription_id: String,
    pub(super) status: SubscriptionStatus,
    pub(super) current_period_end: Option<DateTime<Utc>>,
    pub(super) trial_end: Option<DateTime<Utc>>,
    pub(super) cancel_at_period_end: bool,
    pub(super) items: Vec<NormalizedItem>,
    pub(super) plan: Plan,
}

pub(super) fn normalize(
    subscription: &Subscription,
    prices: Option<&VerifiedPriceIds>,
    stored_items: &[BillingSubscriptionItem],
) -> Result<NormalizedSubscription, AttemptError> {
    let status = status(subscription.status)?;
    let mut items = Vec::new();
    let mut current_period_end: Option<DateTime<Utc>> = None;
    for item in &subscription.items.data {
        let seat_kind =
            item_seat_kind(item, prices, stored_items).ok_or(AttemptError::Malformed)?;
        if items
            .iter()
            .any(|existing: &NormalizedItem| existing.seat_kind == seat_kind)
        {
            return Err(AttemptError::Malformed);
        }
        let quantity = i32::try_from(item.quantity)
            .ok()
            .filter(|value| *value >= 0);
        let Some(quantity) = quantity else {
            return Err(AttemptError::Malformed);
        };
        let Some(period_end) = DateTime::from_timestamp(item.current_period_end, 0) else {
            return Err(AttemptError::Malformed);
        };
        current_period_end =
            Some(current_period_end.map_or(period_end, |current| current.max(period_end)));
        items.push(NormalizedItem {
            seat_kind,
            provider_item_id: item.id.clone(),
            price_id: item.price.id.clone(),
            quantity,
        });
    }
    let trial_end = match subscription.trial_end {
        Some(value) => Some(DateTime::from_timestamp(value, 0).ok_or(AttemptError::Malformed)?),
        None => None,
    };
    Ok(NormalizedSubscription {
        provider_subscription_id: subscription.id.clone(),
        status,
        current_period_end,
        trial_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        items,
        plan: if status.is_live() {
            Plan::Team
        } else {
            Plan::Free
        },
    })
}

pub(super) fn item_seat_kind(
    item: &SubscriptionItem,
    prices: Option<&VerifiedPriceIds>,
    stored_items: &[BillingSubscriptionItem],
) -> Option<SeatKind> {
    if let Some(kind) = CATALOGUE
        .seats
        .iter()
        .find(|seat| item.price.lookup_key.as_deref() == Some(seat.lookup_key))
        .map(|seat| seat.kind)
    {
        return Some(kind);
    }
    if let Some(prices) = prices {
        if item.price.id == prices.editor {
            return Some(SeatKind::Editor);
        }
        if item.price.id == prices.collaborator {
            return Some(SeatKind::Collaborator);
        }
    }
    if let Some(kind) = item
        .price
        .metadata
        .get(PRICE_SEAT_KIND_METADATA)
        .and_then(|value| value.parse::<SeatKind>().ok())
        .filter(|kind| CATALOGUE.seats.iter().any(|seat| seat.kind == *kind))
    {
        return Some(kind);
    }
    stored_items
        .iter()
        .find(|stored| stored.provider_item_id == item.id)
        .map(|stored| stored.seat_kind)
}

pub(super) fn payment_failed(subscription: &Subscription) -> Result<bool, AttemptError> {
    let Some(ExpandableInvoice::Object(invoice)) = &subscription.latest_invoice else {
        return Err(AttemptError::Malformed);
    };
    match invoice.status {
        Some(InvoiceStatus::Open) if invoice.attempted => Ok(true),
        Some(InvoiceStatus::Uncollectible) => Ok(true),
        Some(
            InvoiceStatus::Draft | InvoiceStatus::Open | InvoiceStatus::Paid | InvoiceStatus::Void,
        ) => Ok(false),
        Some(InvoiceStatus::Unknown) | None => Err(AttemptError::Malformed),
    }
}

/// Map every status the pinned API can send; only an unknown status is malformed.
///
/// `paused` occurs only when a trial ends without a payment method, which
/// Checkout with payment collected up front prevents. It still maps to a
/// non-live status so the typed decoder has no gap.
fn status(value: ProviderStatus) -> Result<SubscriptionStatus, AttemptError> {
    match value {
        ProviderStatus::Trialing => Ok(SubscriptionStatus::Trialing),
        ProviderStatus::Active => Ok(SubscriptionStatus::Active),
        ProviderStatus::PastDue => Ok(SubscriptionStatus::PastDue),
        ProviderStatus::Canceled => Ok(SubscriptionStatus::Canceled),
        ProviderStatus::Unpaid => Ok(SubscriptionStatus::Unpaid),
        ProviderStatus::Incomplete => Ok(SubscriptionStatus::Incomplete),
        ProviderStatus::IncompleteExpired => Ok(SubscriptionStatus::IncompleteExpired),
        ProviderStatus::Paused => Ok(SubscriptionStatus::Paused),
        ProviderStatus::Unknown => Err(AttemptError::Malformed),
    }
}
