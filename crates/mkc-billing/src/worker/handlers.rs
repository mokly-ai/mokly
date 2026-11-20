//! Typed event decoding and provider preparation outside database transactions.

use chrono::{DateTime, Utc};
use mkc_billing_interface::objects::{Event, EventKind, Subscription, SubscriptionStatus};
use mkc_domain::ids::OrganizationId;
use mkc_store_interface::store::Callback;
use serde::Deserialize;
use serde::de::DeserializeOwned;
use serde_json::Value;
use uuid::Uuid;

use super::retry::AttemptError;
use super::worker::DatabaseBillingDeliveryWorker;

pub(super) enum Prepared {
    Ignored,
    Reconcile {
        organization: OrganizationId,
        subscription: Subscription,
        created: DateTime<Utc>,
    },
    Invoice {
        organization: OrganizationId,
        subscription: Subscription,
        created: DateTime<Utc>,
    },
}

#[derive(Deserialize)]
struct SubscriptionReference {
    id: String,
    customer: String,
}

#[derive(Deserialize)]
struct EventHeader {
    #[serde(rename = "type")]
    type_: String,
    created: i64,
}

#[derive(Deserialize)]
struct CheckoutReference {
    customer: String,
    subscription: String,
    client_reference_id: String,
}

#[derive(Deserialize)]
struct InvoiceReference {
    customer: String,
    subscription: Option<String>,
    parent: Option<InvoiceParent>,
}

#[derive(Deserialize)]
struct InvoiceParent {
    subscription_details: Option<SubscriptionDetails>,
}

#[derive(Deserialize)]
struct SubscriptionDetails {
    subscription: String,
}

impl DatabaseBillingDeliveryWorker {
    pub(super) fn prepare(&self, body: &[u8]) -> Result<Prepared, AttemptError> {
        let header: EventHeader = decode(body)?;
        let kind = EventKind::from_type(&header.type_);
        if kind == EventKind::Unknown {
            return Ok(Prepared::Ignored);
        }
        let event: Event = decode(body)?;
        if event.created != header.created || event.kind() != kind {
            return Err(AttemptError::Malformed);
        }
        let created = DateTime::from_timestamp(header.created, 0).ok_or(AttemptError::Malformed)?;
        match kind {
            EventKind::Unknown => Ok(Prepared::Ignored),
            EventKind::CheckoutSessionCompleted => self.checkout(event.data.object, created),
            EventKind::CustomerSubscriptionCreated | EventKind::CustomerSubscriptionUpdated => {
                self.subscription(event.data.object, created)
            }
            EventKind::CustomerSubscriptionDeleted => self.deleted(event.data.object, created),
            EventKind::InvoicePaid | EventKind::InvoicePaymentFailed => {
                self.invoice(event.data.object, created)
            }
        }
    }

    fn checkout(&self, object: Value, created: DateTime<Utc>) -> Result<Prepared, AttemptError> {
        let reference: CheckoutReference = decode_value(object)?;
        let organization = reference
            .client_reference_id
            .parse::<Uuid>()
            .ok()
            .map(OrganizationId)
            .ok_or(AttemptError::Malformed)?;
        let Some(customer_org) = self.customer_organization(&reference.customer)? else {
            return Ok(Prepared::Ignored);
        };
        if customer_org != organization || reference.subscription.is_empty() {
            return Err(AttemptError::Malformed);
        }
        let subscription = self.retrieve(&reference.subscription)?;
        if subscription.customer != reference.customer || subscription.id != reference.subscription
        {
            return Err(AttemptError::Malformed);
        }
        Ok(Prepared::Reconcile {
            organization,
            subscription,
            created,
        })
    }

    fn subscription(
        &self,
        object: Value,
        created: DateTime<Utc>,
    ) -> Result<Prepared, AttemptError> {
        let reference: SubscriptionReference = decode_value(object)?;
        let Some(organization) = self.customer_organization(&reference.customer)? else {
            return Ok(Prepared::Ignored);
        };
        let subscription = self.retrieve(&reference.id)?;
        if subscription.customer != reference.customer || subscription.id != reference.id {
            return Err(AttemptError::Malformed);
        }
        Ok(Prepared::Reconcile {
            organization,
            subscription,
            created,
        })
    }

    fn deleted(&self, object: Value, created: DateTime<Utc>) -> Result<Prepared, AttemptError> {
        let mut subscription: Subscription = decode_value(object)?;
        if subscription.status == SubscriptionStatus::Unknown {
            return Err(AttemptError::Malformed);
        }
        let Some(organization) = self.customer_organization(&subscription.customer)? else {
            return Ok(Prepared::Ignored);
        };
        subscription.status = SubscriptionStatus::Canceled;
        Ok(Prepared::Reconcile {
            organization,
            subscription,
            created,
        })
    }

    fn invoice(&self, object: Value, created: DateTime<Utc>) -> Result<Prepared, AttemptError> {
        let invoice: InvoiceReference = decode_value(object)?;
        let Some(organization) = self.customer_organization(&invoice.customer)? else {
            return Ok(Prepared::Ignored);
        };
        let subscription_id = invoice.subscription.or_else(|| {
            invoice
                .parent
                .and_then(|parent| parent.subscription_details)
                .map(|details| details.subscription)
        });
        let Some(subscription_id) = subscription_id.filter(|value| !value.is_empty()) else {
            return Err(AttemptError::Malformed);
        };
        let subscription = self.retrieve(&subscription_id)?;
        if subscription.customer != invoice.customer || subscription.id != subscription_id {
            return Err(AttemptError::Malformed);
        }
        Ok(Prepared::Invoice {
            organization,
            subscription,
            created,
        })
    }

    fn retrieve(&self, id: &str) -> Result<Subscription, AttemptError> {
        if id.is_empty() {
            return Err(AttemptError::Malformed);
        }
        match self.provider.retrieve_subscription(id) {
            Ok(subscription) => Ok(subscription),
            Err(error) => Err(AttemptError::Provider(error)),
        }
    }

    fn customer_organization(
        &self,
        customer: &str,
    ) -> Result<Option<OrganizationId>, AttemptError> {
        if customer.is_empty() {
            return Err(AttemptError::Malformed);
        }
        let mut organization = None;
        if let Err(error) = self.store.read(&mut Callback(&mut |queries| {
            organization = queries
                .billing_customer_by_provider_id(customer)?
                .map(|value| value.organization_id);
            Ok(())
        })) {
            return Err(AttemptError::Store(error));
        }
        Ok(organization)
    }
}

fn decode<T: DeserializeOwned>(body: &[u8]) -> Result<T, AttemptError> {
    serde_json::from_slice(body).or(Err(AttemptError::Malformed))
}

fn decode_value<T: DeserializeOwned>(value: Value) -> Result<T, AttemptError> {
    serde_json::from_value(value).or(Err(AttemptError::Malformed))
}
