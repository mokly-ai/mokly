//! Pure selection of the next provider seat operation.

use mkc_domain::values::SeatKind;
use mkc_store_interface::billing_subscription::BillingSubscriptionItem;
use mkc_store_interface::organization::SeatCounts;

#[derive(Clone)]
pub(super) enum ActionKind {
    Create,
    Update { provider_item_id: String },
    Delete { provider_item_id: String },
}

#[derive(Clone)]
pub(super) struct Action {
    pub(super) kind: SeatKind,
    pub(super) quantity: i32,
    pub(super) price_id: String,
    pub(super) operation: ActionKind,
}

pub(super) fn select(
    counts: SeatCounts,
    items: &[BillingSubscriptionItem],
    kind: SeatKind,
    price_id: &str,
) -> Option<Action> {
    let quantity = match kind {
        SeatKind::Editor => i32::try_from(counts.editors).ok()?,
        SeatKind::Collaborator => i32::try_from(counts.collaborators).ok()?,
    };
    if kind == SeatKind::Editor && quantity < 1 {
        return None;
    }
    let item = items.iter().find(|item| item.seat_kind == kind);
    if item.is_some_and(|item| item.quantity == quantity) {
        return None;
    }
    let operation = match (kind, item, quantity) {
        (SeatKind::Collaborator, None, 0) => return None,
        (_, None, _) => ActionKind::Create,
        (SeatKind::Collaborator, Some(item), 0) => ActionKind::Delete {
            provider_item_id: item.provider_item_id.clone(),
        },
        (_, Some(item), _) => ActionKind::Update {
            provider_item_id: item.provider_item_id.clone(),
        },
    };
    let price_id = item.map_or(price_id, |item| item.price_id.as_str());
    Some(Action {
        kind,
        quantity,
        price_id: price_id.to_owned(),
        operation,
    })
}
