//! Authorized billing projection from persisted state and verified prices.

use mkc_domain::ids::{OrganizationId, UserId};
use mkc_domain::values::{Role, SeatKind};
use mkc_store_interface::store::Callback;

use crate::billing::error::{Error, ErrorResultExt, Result};

use super::service::{DatabaseBillingService, Permission, authorize};
use super::views::{Billing, SeatUsage, Subscription};

impl DatabaseBillingService {
    pub(super) fn read_billing(&self, actor: UserId, workspace: OrganizationId) -> Result<Billing> {
        let mut workspace_record = None;
        let mut role = None;
        let mut counts = None;
        let mut subscription = None;
        self.store
            .read(&mut Callback(&mut |queries| {
                workspace_record = queries.organization(workspace)?;
                role = queries
                    .members(workspace)?
                    .into_iter()
                    .find(|member| member.user_id == Some(actor))
                    .map(|member| member.role);
                if role.is_some_and(Role::can_admin) {
                    counts = Some(queries.seat_counts(workspace)?);
                    subscription = queries.billing_subscription(workspace)?;
                }
                Ok(())
            }))
            .context("read workspace billing")?;
        let workspace_record = workspace_record.ok_or(Error::NotFound)?;
        let role = role.ok_or(Error::NotFound)?;
        authorize(role, Permission::Read)?;
        let counts = counts.ok_or(Error::NotFound)?;
        let checkout_available = self.prices.checkout_available()
            && !subscription
                .as_ref()
                .is_some_and(|value| value.status.is_live());
        Ok(Billing {
            plan: workspace_record.plan,
            seats: vec![
                SeatUsage {
                    kind: SeatKind::Editor,
                    in_use: counts.editors,
                    unit_amount_cents: self
                        .prices
                        .editor
                        .as_ref()
                        .map(|price| price.catalogue.unit_amount_cents),
                },
                SeatUsage {
                    kind: SeatKind::Collaborator,
                    in_use: counts.collaborators,
                    unit_amount_cents: self
                        .prices
                        .collaborator
                        .as_ref()
                        .map(|price| price.catalogue.unit_amount_cents),
                },
            ],
            subscription: subscription.map(|value| Subscription {
                status: value.status.into(),
                trial_end: value.trial_end,
                current_period_end: value.current_period_end,
                cancel_at_period_end: value.cancel_at_period_end,
                payment_failed_at: value.payment_failed_at,
            }),
            manageable: role == Role::Owner,
            checkout_available,
        })
    }
}
