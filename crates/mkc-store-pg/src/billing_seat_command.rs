//! Durable seat-command reservation, leasing, retry and cleanup.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use mkc_db::schema::billing_commands::billing_seat_commands;
use mkc_domain::ids::OrganizationId;
use mkc_domain::values::SeatKind;
use mkc_store_interface::billing_seat_command::{BillingSeatCommand, BillingSeatCommands};
use mkc_store_interface::error::{Error, ErrorResultExt, Result};
use uuid::Uuid;

use crate::billing_rows::seat_command::Row;
use crate::queries::PgQueries;

impl BillingSeatCommands for PgQueries<'_> {
    fn billing_seat_command(
        &mut self,
        organization: OrganizationId,
        kind: SeatKind,
    ) -> Result<Option<BillingSeatCommand>> {
        billing_seat_commands::table
            .filter(billing_seat_commands::organization_id.eq(organization.0))
            .filter(billing_seat_commands::seat_kind.eq(kind.as_str()))
            .select(Row::as_select())
            .first(self.connection)
            .optional()
            .context("read billing seat command")?
            .map(Row::dto)
            .transpose()
    }

    fn billing_seat_commands(
        &mut self,
        organization: OrganizationId,
    ) -> Result<Vec<BillingSeatCommand>> {
        billing_seat_commands::table
            .filter(billing_seat_commands::organization_id.eq(organization.0))
            .order(billing_seat_commands::seat_kind.asc())
            .select(Row::as_select())
            .load(self.connection)
            .context("list billing seat commands")?
            .into_iter()
            .map(Row::dto)
            .collect()
    }

    fn reserve_billing_seat_command(
        &mut self,
        candidate: &BillingSeatCommand,
    ) -> Result<BillingSeatCommand> {
        diesel::insert_into(billing_seat_commands::table)
            .values(Row::record(candidate))
            .on_conflict((
                billing_seat_commands::organization_id,
                billing_seat_commands::seat_kind,
            ))
            .do_nothing()
            .execute(self.connection)
            .context("reserve billing seat command")?;
        self.billing_seat_command(candidate.organization_id, candidate.seat_kind)?
            .ok_or_else(|| {
                Error::internal_message("reserved billing seat command was not readable")
            })
    }

    fn claim_billing_seat_command(
        &mut self,
        id: Uuid,
        lease: Uuid,
        now: DateTime<Utc>,
        lease_until: DateTime<Utc>,
    ) -> Result<Option<BillingSeatCommand>> {
        diesel::update(
            billing_seat_commands::table
                .find(id)
                .filter(billing_seat_commands::due_at.le(now))
                .filter(
                    billing_seat_commands::lease_until
                        .is_null()
                        .or(billing_seat_commands::lease_until.le(now)),
                ),
        )
        .set((
            billing_seat_commands::lease.eq(Some(lease)),
            billing_seat_commands::lease_until.eq(Some(lease_until)),
            billing_seat_commands::attempts.eq(billing_seat_commands::attempts + 1),
        ))
        .returning(Row::as_returning())
        .get_result(self.connection)
        .optional()
        .context("claim billing seat command")?
        .map(Row::dto)
        .transpose()
    }

    fn release_billing_seat_command(
        &mut self,
        id: Uuid,
        lease: Uuid,
        due_at: DateTime<Utc>,
    ) -> Result<bool> {
        let changed = diesel::update(
            billing_seat_commands::table
                .find(id)
                .filter(billing_seat_commands::lease.eq(lease)),
        )
        .set((
            billing_seat_commands::due_at.eq(due_at),
            billing_seat_commands::lease.eq(Option::<Uuid>::None),
            billing_seat_commands::lease_until.eq(Option::<DateTime<Utc>>::None),
        ))
        .execute(self.connection)
        .context("release billing seat command")?;
        Ok(changed == 1)
    }

    fn delete_billing_seat_command(&mut self, id: Uuid) -> Result<()> {
        diesel::delete(billing_seat_commands::table.find(id))
            .execute(self.connection)
            .context("delete billing seat command")?;
        Ok(())
    }
}
