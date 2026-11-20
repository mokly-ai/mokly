//! Pure product, price, and predecessor-sweep decisions.

use std::collections::BTreeMap;

use mkc_billing_interface::catalogue::{Product, TaxBehavior as ProviderTaxBehavior};
use mkc_billing_interface::catalogue_provider::{
    CreatePrice, CreateProduct, RunId, UpdatePrice, UpdateProduct,
};
use mkc_billing_interface::objects::Price;
use mkc_domain::billing::{
    Catalogue, PRICE_SEAT_KIND_METADATA, PRODUCT_LOOKUP_KEY_METADATA, SeatPrice, TaxBehavior,
};

pub(super) const REPLACED_PRICE_METADATA: &str = "mokly_replaces";

/// Reconciliation decision for the catalogue product.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum ProductDecision {
    Create(CreateProduct),
    Update {
        id: String,
        input: UpdateProduct,
    },
    Validated {
        id: String,
    },
    DuplicateActive {
        lookup_key: String,
        products: Vec<String>,
    },
}

/// Catalogue-owned price fields independent of the resolved product ID.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct PriceFields {
    pub(crate) currency: String,
    pub(crate) unit_amount: i64,
    pub(crate) interval: String,
    pub(crate) usage_type: String,
    pub(crate) tax_behavior: ProviderTaxBehavior,
    pub(crate) lookup_key: String,
    pub(crate) nickname: String,
    pub(crate) metadata: BTreeMap<String, String>,
}

impl PriceFields {
    /// Resolve provider write input after the intended product has an ID.
    pub(crate) fn create_input(
        &self,
        run: RunId,
        product: &str,
        replaces: Option<&str>,
    ) -> CreatePrice {
        let mut metadata = self.metadata.clone();
        if let Some(replaced) = replaces {
            metadata.insert(REPLACED_PRICE_METADATA.to_owned(), replaced.to_owned());
        }
        CreatePrice {
            run,
            product: product.to_owned(),
            currency: self.currency.clone(),
            unit_amount: self.unit_amount,
            interval: self.interval.clone(),
            usage_type: self.usage_type.clone(),
            tax_behavior: self.tax_behavior,
            lookup_key: self.lookup_key.clone(),
            nickname: self.nickname.clone(),
            metadata,
            replaces: replaces.map(str::to_owned),
        }
    }
}

/// Reconciliation decision for one catalogue price.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum PriceDecision {
    Create(PriceFields),
    Replace {
        predecessor: String,
        repair: Option<UpdatePrice>,
        fields: PriceFields,
    },
    Update {
        id: String,
        input: UpdatePrice,
    },
    Validated {
        id: String,
    },
}

/// Choose the one product identity and its necessary write, if any.
pub(crate) fn decide_product(
    catalogue: &Catalogue,
    products: &[Product],
    run: RunId,
) -> ProductDecision {
    let candidates: Vec<&Product> = products
        .iter()
        .filter(|product| {
            product
                .metadata
                .get(PRODUCT_LOOKUP_KEY_METADATA)
                .is_some_and(|key| key == catalogue.product.lookup_key)
        })
        .collect();
    let mut active: Vec<&Product> = candidates
        .iter()
        .copied()
        .filter(|product| product.active)
        .collect();
    if active.len() > 1 {
        let mut products: Vec<String> = active.drain(..).map(|item| item.id.clone()).collect();
        products.sort();
        return ProductDecision::DuplicateActive {
            lookup_key: catalogue.product.lookup_key.to_owned(),
            products,
        };
    }
    if let Some(product) = active.first() {
        return adopted_product(catalogue, product, run);
    }
    match candidates
        .into_iter()
        .filter(|product| !product.active)
        .max_by(|left, right| {
            left.created
                .cmp(&right.created)
                .then_with(|| left.id.cmp(&right.id))
        }) {
        Some(product) => ProductDecision::Update {
            id: product.id.clone(),
            input: product_update(catalogue, run),
        },
        None => ProductDecision::Create(product_create(catalogue, run)),
    }
}

/// Locate the active provider price returned for one stable lookup key.
pub(crate) fn find_price<'a>(prices: &'a [Price], lookup_key: &str) -> Option<&'a Price> {
    prices
        .iter()
        .find(|price| price.lookup_key.as_deref() == Some(lookup_key))
}

/// Compare one returned price with all catalogue-owned fields.
pub(crate) fn decide_price(
    catalogue: &Catalogue,
    seat: &SeatPrice,
    product_id: Option<&str>,
    price: Option<&Price>,
    run: RunId,
) -> PriceDecision {
    let fields = price_fields(catalogue, seat);
    let Some(price) = price else {
        return PriceDecision::Create(fields);
    };
    let repair = mutable_price_update(price, seat, run.clone());
    if !immutable_price_matches(price, product_id, &fields) {
        return PriceDecision::Replace {
            predecessor: price.id.clone(),
            repair,
            fields,
        };
    }
    if let Some(input) = repair {
        return PriceDecision::Update {
            id: price.id.clone(),
            input,
        };
    }
    PriceDecision::Validated {
        id: price.id.clone(),
    }
}

fn mutable_price_update(price: &Price, seat: &SeatPrice, run: RunId) -> Option<UpdatePrice> {
    let differs = price.nickname.as_deref() != Some(seat.nickname)
        || price
            .metadata
            .get(PRICE_SEAT_KIND_METADATA)
            .is_none_or(|kind| kind != seat.kind.as_str());
    differs.then(|| UpdatePrice {
        run,
        nickname: Some(seat.nickname.to_owned()),
        metadata: price_metadata(seat),
        active: None,
    })
}

fn adopted_product(catalogue: &Catalogue, product: &Product, run: RunId) -> ProductDecision {
    let owned_name_differs = product.name != catalogue.product.name;
    let owned_identity_differs = product
        .metadata
        .get(PRODUCT_LOOKUP_KEY_METADATA)
        .is_none_or(|key| key != catalogue.product.lookup_key);
    if !product.active || owned_name_differs || owned_identity_differs {
        ProductDecision::Update {
            id: product.id.clone(),
            input: product_update(catalogue, run),
        }
    } else {
        ProductDecision::Validated {
            id: product.id.clone(),
        }
    }
}

fn immutable_price_matches(price: &Price, product_id: Option<&str>, fields: &PriceFields) -> bool {
    product_id.is_some_and(|product| price.product.id() == product)
        && price.currency == fields.currency
        && price.unit_amount == Some(fields.unit_amount)
        && price.recurring.as_ref().is_some_and(|recurring| {
            recurring.interval == fields.interval && recurring.usage_type == fields.usage_type
        })
        && price.tax_behavior == Some(fields.tax_behavior)
}

fn product_create(catalogue: &Catalogue, run: RunId) -> CreateProduct {
    CreateProduct {
        run,
        lookup_key: catalogue.product.lookup_key.to_owned(),
        name: catalogue.product.name.to_owned(),
        metadata: product_metadata(catalogue),
    }
}

fn product_update(catalogue: &Catalogue, run: RunId) -> UpdateProduct {
    UpdateProduct {
        run,
        name: catalogue.product.name.to_owned(),
        active: true,
        metadata: product_metadata(catalogue),
    }
}

fn product_metadata(catalogue: &Catalogue) -> BTreeMap<String, String> {
    BTreeMap::from([(
        PRODUCT_LOOKUP_KEY_METADATA.to_owned(),
        catalogue.product.lookup_key.to_owned(),
    )])
}

fn price_fields(catalogue: &Catalogue, seat: &SeatPrice) -> PriceFields {
    PriceFields {
        currency: catalogue.currency.to_owned(),
        unit_amount: i64::from(seat.unit_amount_cents),
        interval: catalogue.interval.to_owned(),
        usage_type: catalogue.usage_type.to_owned(),
        tax_behavior: provider_tax_behavior(seat.tax_behavior),
        lookup_key: seat.lookup_key.to_owned(),
        nickname: seat.nickname.to_owned(),
        metadata: price_metadata(seat),
    }
}

fn price_metadata(seat: &SeatPrice) -> BTreeMap<String, String> {
    BTreeMap::from([(
        PRICE_SEAT_KIND_METADATA.to_owned(),
        seat.kind.as_str().to_owned(),
    )])
}

fn provider_tax_behavior(value: TaxBehavior) -> ProviderTaxBehavior {
    match value {
        TaxBehavior::Exclusive => ProviderTaxBehavior::Exclusive,
        TaxBehavior::Inclusive => ProviderTaxBehavior::Inclusive,
        TaxBehavior::Unspecified => ProviderTaxBehavior::Unspecified,
    }
}
