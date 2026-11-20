//! Private Diesel row mapping for durable Checkout requests.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use mkc_db::schema::billing_commands::billing_checkout_sessions;
use mkc_store_interface::billing_checkout::BillingCheckoutSession;
use uuid::Uuid;

#[derive(Queryable, Selectable, Insertable, AsChangeset)]
#[diesel(table_name = billing_checkout_sessions)]
#[diesel(treat_none_as_null = true)]
#[diesel(primary_key(id))]
pub(crate) struct Row {
    id: Uuid,
    organization_id: Uuid,
    provider_customer_id: String,
    editor_price_id: String,
    editor_quantity: i32,
    collaborator_price_id: String,
    collaborator_quantity: i32,
    trial_period_days: Option<i32>,
    success_url: String,
    cancel_url: String,
    expires_at: DateTime<Utc>,
    idempotency_key: String,
    provider_session_id: Option<String>,
    provider_session_url: Option<String>,
    created_at: DateTime<Utc>,
    version: i64,
}

impl Row {
    pub(crate) fn dto(self) -> BillingCheckoutSession {
        BillingCheckoutSession {
            id: self.id,
            organization_id: self.organization_id.into(),
            provider_customer_id: self.provider_customer_id,
            editor_price_id: self.editor_price_id,
            editor_quantity: self.editor_quantity,
            collaborator_price_id: self.collaborator_price_id,
            collaborator_quantity: self.collaborator_quantity,
            trial_period_days: self.trial_period_days,
            success_url: self.success_url,
            cancel_url: self.cancel_url,
            expires_at: self.expires_at,
            idempotency_key: self.idempotency_key,
            provider_session_id: self.provider_session_id,
            provider_session_url: self.provider_session_url,
            created_at: self.created_at,
            version: self.version,
        }
    }

    pub(crate) fn record(value: &BillingCheckoutSession) -> Self {
        Self {
            id: value.id,
            organization_id: value.organization_id.0,
            provider_customer_id: value.provider_customer_id.clone(),
            editor_price_id: value.editor_price_id.clone(),
            editor_quantity: value.editor_quantity,
            collaborator_price_id: value.collaborator_price_id.clone(),
            collaborator_quantity: value.collaborator_quantity,
            trial_period_days: value.trial_period_days,
            success_url: value.success_url.clone(),
            cancel_url: value.cancel_url.clone(),
            expires_at: value.expires_at,
            idempotency_key: value.idempotency_key.clone(),
            provider_session_id: value.provider_session_id.clone(),
            provider_session_url: value.provider_session_url.clone(),
            created_at: value.created_at,
            version: value.version,
        }
    }
}
