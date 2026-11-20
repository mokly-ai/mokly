//! Runtime customer, Checkout, subscription, and price operations.

use mkc_billing_interface::error::{Error, Result};
use mkc_billing_interface::http::Method;
use mkc_billing_interface::objects::{
    CheckoutSession, Customer, List, PortalSession, Price, Subscription, SubscriptionItem,
};
use mkc_billing_interface::provider::{BillingProvider, CreateCheckout, CreateCustomer};
use serde::Deserialize;

use super::StripeClient;
use super::failure::ClientFailure;
use super::form::{push_metadata, push_subscription_metadata};
use super::validation::{
    derived_key, validate_idempotency_key, validate_lookup_keys, validate_quantity_and_key,
    validate_segment,
};

#[derive(Deserialize)]
struct DeletedItem {
    id: String,
    deleted: bool,
}

impl BillingProvider for StripeClient {
    fn create_customer(&self, input: &CreateCustomer) -> Result<Customer> {
        let organization = input
            .metadata
            .get("organization_id")
            .filter(|value| !value.is_empty())
            .ok_or_else(Error::invalid_request)?;
        let mut form = vec![
            ("name".to_owned(), input.name.clone()),
            ("email".to_owned(), input.email.clone()),
        ];
        push_metadata(&mut form, &input.metadata);
        self.call(
            Method::Post,
            "/v1/customers".to_owned(),
            Some(derived_key("customer", organization)?),
            form,
        )
    }

    fn create_checkout_session(&self, input: &CreateCheckout) -> Result<CheckoutSession> {
        validate_segment(&input.customer)?;
        if input.client_reference_id.is_empty()
            || input.line_items.is_empty()
            || input.line_items.iter().any(|item| item.quantity <= 0)
            || input.trial_period_days == Some(0)
        {
            return Err(Error::invalid_request());
        }
        validate_idempotency_key(&input.idempotency_key)?;
        let mut form = vec![
            ("mode".to_owned(), "subscription".to_owned()),
            ("customer".to_owned(), input.customer.clone()),
            (
                "client_reference_id".to_owned(),
                input.client_reference_id.clone(),
            ),
            ("success_url".to_owned(), input.success_url.clone()),
            ("cancel_url".to_owned(), input.cancel_url.clone()),
        ];
        for (index, item) in input.line_items.iter().enumerate() {
            validate_segment(&item.price)?;
            form.push((format!("line_items[{index}][price]"), item.price.clone()));
            form.push((
                format!("line_items[{index}][quantity]"),
                item.quantity.to_string(),
            ));
        }
        if let Some(days) = input.trial_period_days {
            form.push((
                "subscription_data[trial_period_days]".to_owned(),
                days.to_string(),
            ));
        }
        form.push((
            "automatic_tax[enabled]".to_owned(),
            input.automatic_tax.to_string(),
        ));
        if input.collect_billing_address {
            form.push((
                "billing_address_collection".to_owned(),
                "required".to_owned(),
            ));
        }
        if input.save_customer_address {
            form.push(("customer_update[address]".to_owned(), "auto".to_owned()));
        }
        if let Some(expires_at) = input.expires_at {
            form.push(("expires_at".to_owned(), expires_at.to_string()));
        }
        push_metadata(&mut form, &input.metadata);
        push_subscription_metadata(&mut form, &input.metadata);
        self.call(
            Method::Post,
            "/v1/checkout/sessions".to_owned(),
            Some(input.idempotency_key.clone()),
            form,
        )
    }

    fn create_portal_session(
        &self,
        customer: &str,
        return_url: &str,
        idempotency_key: &str,
    ) -> Result<PortalSession> {
        validate_segment(customer)?;
        if return_url.is_empty() {
            return Err(Error::invalid_request());
        }
        validate_idempotency_key(idempotency_key)?;
        self.call(
            Method::Post,
            "/v1/billing_portal/sessions".to_owned(),
            Some(idempotency_key.to_owned()),
            vec![
                ("customer".to_owned(), customer.to_owned()),
                ("return_url".to_owned(), return_url.to_owned()),
            ],
        )
    }

    fn retrieve_subscription(&self, id: &str) -> Result<Subscription> {
        self.call(
            Method::Get,
            format!("/v1/subscriptions/{}", validate_segment(id)?),
            None,
            vec![
                ("expand[]".to_owned(), "items".to_owned()),
                ("expand[]".to_owned(), "latest_invoice".to_owned()),
            ],
        )
    }

    fn cancel_subscription(&self, id: &str) -> Result<Subscription> {
        let id = validate_segment(id)?;
        self.call(
            Method::Delete,
            format!("/v1/subscriptions/{id}"),
            Some(derived_key("cancel", id)?),
            Vec::new(),
        )
    }

    fn create_subscription_item(
        &self,
        subscription: &str,
        price: &str,
        quantity: i64,
        idempotency_key: &str,
    ) -> Result<SubscriptionItem> {
        validate_segment(subscription)?;
        validate_segment(price)?;
        validate_quantity_and_key(quantity, idempotency_key)?;
        self.call(
            Method::Post,
            "/v1/subscription_items".to_owned(),
            Some(idempotency_key.to_owned()),
            vec![
                ("subscription".to_owned(), subscription.to_owned()),
                ("price".to_owned(), price.to_owned()),
                ("quantity".to_owned(), quantity.to_string()),
            ],
        )
    }

    fn update_subscription_item(
        &self,
        item: &str,
        quantity: i64,
        idempotency_key: &str,
    ) -> Result<SubscriptionItem> {
        let item = validate_segment(item)?;
        validate_quantity_and_key(quantity, idempotency_key)?;
        self.call(
            Method::Post,
            format!("/v1/subscription_items/{item}"),
            Some(idempotency_key.to_owned()),
            vec![("quantity".to_owned(), quantity.to_string())],
        )
    }

    fn delete_subscription_item(&self, item: &str) -> Result<()> {
        let item = validate_segment(item)?;
        let deleted: DeletedItem = self.call(
            Method::Delete,
            format!("/v1/subscription_items/{item}"),
            None,
            Vec::new(),
        )?;
        if !deleted.deleted || deleted.id != item {
            return Err(Error::internal(ClientFailure::DeleteNotConfirmed));
        }
        Ok(())
    }

    fn list_prices_by_lookup_keys(&self, lookup_keys: &[String]) -> Result<Vec<Price>> {
        validate_lookup_keys(lookup_keys)?;
        let mut form = vec![("active".to_owned(), "true".to_owned())];
        for lookup_key in lookup_keys {
            form.push(("lookup_keys[]".to_owned(), lookup_key.clone()));
        }
        form.push(("expand[]".to_owned(), "data.product".to_owned()));
        form.push(("limit".to_owned(), "10".to_owned()));
        let page: List<Price> = self.call(Method::Get, "/v1/prices".to_owned(), None, form)?;
        let Some(has_more) = page.has_more else {
            return Err(Error::internal(
                ClientFailure::LookupPricesPaginationMissing,
            ));
        };
        if has_more {
            return Err(Error::internal(ClientFailure::LookupPricesHaveMore));
        }
        Ok(page.data)
    }
}
