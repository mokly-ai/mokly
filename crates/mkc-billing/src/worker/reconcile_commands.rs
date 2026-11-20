//! Seat-command confirmation against one normalized provider subscription.

use mkc_domain::ids::OrganizationId;
use mkc_store_interface::billing_seat_command::{BillingSeatCommand, SeatCommandOperation};
use mkc_store_interface::store::Queries;

use super::plan::NormalizedItem;

pub(super) fn clear_confirmed_commands(
    queries: &mut dyn Queries,
    organization: OrganizationId,
    subscription_id: &str,
    items: &[NormalizedItem],
) -> mkc_store_interface::error::Result<()> {
    for command in queries.billing_seat_commands(organization)? {
        if command.provider_subscription_id == subscription_id && command_confirmed(&command, items)
        {
            queries.delete_billing_seat_command(command.id)?;
        }
    }
    Ok(())
}

fn command_confirmed(command: &BillingSeatCommand, items: &[NormalizedItem]) -> bool {
    match command.operation {
        SeatCommandOperation::Create => items
            .iter()
            .any(|item| item.seat_kind == command.seat_kind && item.quantity == command.quantity),
        SeatCommandOperation::Update => command.provider_item_id.as_deref().is_some_and(|id| {
            items.iter().any(|item| {
                item.seat_kind == command.seat_kind
                    && item.provider_item_id == id
                    && item.quantity == command.quantity
            })
        }),
        SeatCommandOperation::Delete => command.provider_item_id.as_deref().is_some_and(|id| {
            !items
                .iter()
                .any(|item| item.seat_kind == command.seat_kind && item.provider_item_id == id)
        }),
    }
}
