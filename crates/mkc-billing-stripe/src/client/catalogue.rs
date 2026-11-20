//! Cursor-paginated catalogue reads and deterministic catalogue writes.

use mkc_billing_interface::catalogue::{Product, TaxBehavior};
use mkc_billing_interface::catalogue_provider::{
    CatalogueProvider, CreatePrice, CreateProduct, UpdatePrice, UpdateProduct,
};
use mkc_billing_interface::error::{Error, Result};
use mkc_billing_interface::http::Method;
use mkc_billing_interface::objects::{List, Price};
use serde::de::DeserializeOwned;

use super::StripeClient;
use super::failure::{ClientFailure, Listing};
use super::form::push_metadata;
use super::validation::{
    validate_lookup_key, validate_metadata, validate_required, validate_segment,
};

/// Maximum pages read before a malformed or changing catalogue fails closed.
pub(crate) const MAX_CATALOGUE_PAGES: usize = 100;

impl CatalogueProvider for StripeClient {
    fn list_products(&self) -> Result<Vec<Product>> {
        list_pages(
            self,
            "/v1/products",
            vec![("limit".to_owned(), "100".to_owned())],
            Listing::Products,
            |product: &Product| product.id.clone(),
        )
    }

    fn list_product_prices(&self, product: &str) -> Result<Vec<Price>> {
        let product = validate_segment(product)?;
        list_pages(
            self,
            "/v1/prices",
            vec![
                ("product".to_owned(), product.to_owned()),
                ("active".to_owned(), "true".to_owned()),
                ("limit".to_owned(), "100".to_owned()),
            ],
            Listing::ProductPrices,
            |price: &Price| price.id.clone(),
        )
    }

    fn retrieve_price(&self, id: &str) -> Result<Price> {
        let id = validate_segment(id)?;
        self.call(Method::Get, format!("/v1/prices/{id}"), None, Vec::new())
    }

    fn create_product(&self, input: &CreateProduct) -> Result<Product> {
        validate_lookup_key(&input.lookup_key)?;
        validate_required(&input.name)?;
        validate_metadata(&input.metadata)?;
        let mut form = vec![
            ("name".to_owned(), input.name.clone()),
            ("active".to_owned(), "true".to_owned()),
        ];
        push_metadata(&mut form, &input.metadata);
        self.catalogue_write(
            &input.run,
            "product-create",
            &input.lookup_key,
            "/v1/products".to_owned(),
            form,
        )
    }

    fn update_product(&self, product: &str, input: &UpdateProduct) -> Result<Product> {
        let product = validate_segment(product)?;
        validate_required(&input.name)?;
        validate_metadata(&input.metadata)?;
        let mut form = vec![
            ("name".to_owned(), input.name.clone()),
            ("active".to_owned(), input.active.to_string()),
        ];
        push_metadata(&mut form, &input.metadata);
        self.catalogue_write(
            &input.run,
            "product-update",
            product,
            format!("/v1/products/{product}"),
            form,
        )
    }

    fn create_price(&self, input: &CreatePrice) -> Result<Price> {
        validate_segment(&input.product)?;
        validate_lookup_key(&input.lookup_key)?;
        validate_required(&input.currency)?;
        validate_required(&input.interval)?;
        validate_required(&input.usage_type)?;
        validate_required(&input.nickname)?;
        validate_metadata(&input.metadata)?;
        if input.unit_amount < 0 {
            return Err(Error::invalid_request());
        }
        let tax_behavior = writable_tax_behavior(input.tax_behavior)?;
        let target = match &input.replaces {
            Some(price) => validate_segment(price)?,
            None => &input.lookup_key,
        };
        let operation = if input.replaces.is_some() {
            "price-replace"
        } else {
            "price-create"
        };
        let mut form = vec![
            ("product".to_owned(), input.product.clone()),
            ("currency".to_owned(), input.currency.clone()),
            ("unit_amount".to_owned(), input.unit_amount.to_string()),
            ("recurring[interval]".to_owned(), input.interval.clone()),
            ("recurring[usage_type]".to_owned(), input.usage_type.clone()),
            ("tax_behavior".to_owned(), tax_behavior.to_owned()),
            ("lookup_key".to_owned(), input.lookup_key.clone()),
            ("nickname".to_owned(), input.nickname.clone()),
            ("transfer_lookup_key".to_owned(), "true".to_owned()),
        ];
        push_metadata(&mut form, &input.metadata);
        self.catalogue_write(&input.run, operation, target, "/v1/prices".to_owned(), form)
    }

    fn update_price(&self, price: &str, input: &UpdatePrice) -> Result<Price> {
        let price = validate_segment(price)?;
        validate_metadata(&input.metadata)?;
        let mut form = Vec::new();
        if let Some(nickname) = &input.nickname {
            validate_required(nickname)?;
            form.push(("nickname".to_owned(), nickname.clone()));
        }
        push_metadata(&mut form, &input.metadata);
        if let Some(active) = input.active {
            form.push(("active".to_owned(), active.to_string()));
        }
        if form.is_empty() {
            return Err(Error::invalid_request());
        }
        let operation =
            if input.active == Some(false) && input.nickname.is_none() && input.metadata.is_empty()
            {
                "price-archive"
            } else {
                "price-update"
            };
        self.catalogue_write(
            &input.run,
            operation,
            price,
            format!("/v1/prices/{price}"),
            form,
        )
    }
}

fn list_pages<T: DeserializeOwned>(
    client: &StripeClient,
    path: &str,
    base_form: Vec<(String, String)>,
    listing: Listing,
    object_id: fn(&T) -> String,
) -> Result<Vec<T>> {
    let mut objects = Vec::new();
    let mut starting_after: Option<String> = None;
    for page_index in 0..MAX_CATALOGUE_PAGES {
        let mut form = base_form.clone();
        if let Some(cursor) = &starting_after {
            form.push(("starting_after".to_owned(), cursor.clone()));
        }
        let page: List<T> = client.call(Method::Get, path.to_owned(), None, form)?;
        let Some(has_more) = page.has_more else {
            return Err(Error::internal(ClientFailure::CataloguePaginationMissing {
                listing,
            }));
        };
        let cursor = page.data.last().map(object_id);
        objects.extend(page.data);
        if !has_more {
            return Ok(objects);
        }
        let Some(cursor) = cursor else {
            return Err(Error::internal(ClientFailure::CatalogueCursorMissing {
                listing,
            }));
        };
        if page_index + 1 == MAX_CATALOGUE_PAGES {
            return Err(Error::internal(ClientFailure::CataloguePageLimit {
                listing,
            }));
        }
        starting_after = Some(cursor);
    }
    Err(Error::internal(ClientFailure::CataloguePageLimit {
        listing,
    }))
}

fn writable_tax_behavior(value: TaxBehavior) -> Result<&'static str> {
    match value {
        TaxBehavior::Exclusive => Ok("exclusive"),
        TaxBehavior::Inclusive => Ok("inclusive"),
        TaxBehavior::Unspecified => Ok("unspecified"),
        TaxBehavior::Unknown => Err(Error::invalid_request()),
    }
}
