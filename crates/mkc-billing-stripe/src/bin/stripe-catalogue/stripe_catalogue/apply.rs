//! Product and price action execution for catalogue reconciliation.

use mkc_billing_interface::catalogue::Product;
use mkc_billing_interface::objects::Price;
use mkc_domain::billing::Catalogue;

use super::decision::{PriceDecision, ProductDecision, decide_price, decide_product, find_price};
use super::report::{ErrorLine, ObjectAction, PriceAction, ProviderOperation, ReportLine};
use super::sync::{ProductResolution, ProviderCatalogueSync, RunState, provider_result};

impl ProviderCatalogueSync {
    pub(super) fn resolve_product(
        &self,
        catalogue: &Catalogue,
        products: Vec<Product>,
        apply: bool,
        state: &mut RunState,
    ) -> Result<ProductResolution, ErrorLine> {
        let key = catalogue.product.lookup_key.to_owned();
        match decide_product(catalogue, &products, state.run.clone()) {
            ProductDecision::Create(input) if apply => {
                let product = provider_result(
                    self.catalogue_provider.create_product(&input),
                    ProviderOperation::ProductCreate,
                    &input.lookup_key,
                )?;
                state.lines.push(ReportLine::Product {
                    key,
                    action: ObjectAction::Created(product.id.clone()),
                });
                Ok(ProductResolution::Existing(product.id))
            }
            ProductDecision::Create(_) => {
                state.lines.push(ReportLine::Product {
                    key,
                    action: ObjectAction::WouldCreate,
                });
                Ok(ProductResolution::Pending)
            }
            ProductDecision::Update { id, input } if apply => {
                provider_result(
                    self.catalogue_provider.update_product(&id, &input),
                    ProviderOperation::ProductUpdate,
                    &id,
                )?;
                state.lines.push(ReportLine::Product {
                    key,
                    action: ObjectAction::Updated(id.clone()),
                });
                Ok(ProductResolution::Existing(id))
            }
            ProductDecision::Update { id, .. } => {
                state.lines.push(ReportLine::Product {
                    key,
                    action: ObjectAction::WouldUpdate(id.clone()),
                });
                Ok(ProductResolution::Existing(id))
            }
            ProductDecision::Validated { id } => {
                state.lines.push(ReportLine::Product {
                    key,
                    action: ObjectAction::Validated(id.clone()),
                });
                Ok(ProductResolution::Existing(id))
            }
            ProductDecision::DuplicateActive {
                lookup_key,
                products,
            } => Err(ErrorLine::DuplicateActiveProducts {
                lookup_key,
                products,
            }),
        }
    }

    pub(super) fn reconcile_prices(
        &self,
        catalogue: &Catalogue,
        product_id: &str,
        prices: &[Price],
        apply: bool,
        state: &mut RunState,
    ) -> Result<(), ErrorLine> {
        for seat in &catalogue.seats {
            let decision = decide_price(
                catalogue,
                seat,
                Some(product_id),
                find_price(prices, seat.lookup_key),
                state.run.clone(),
            );
            self.reconcile_price(seat.lookup_key, product_id, decision, apply, state)?;
        }
        Ok(())
    }

    fn reconcile_price(
        &self,
        key: &str,
        product_id: &str,
        decision: PriceDecision,
        apply: bool,
        state: &mut RunState,
    ) -> Result<(), ErrorLine> {
        match decision {
            PriceDecision::Create(fields) if apply => {
                let input = fields.create_input(state.run.clone(), product_id, None);
                let price = provider_result(
                    self.catalogue_provider.create_price(&input),
                    ProviderOperation::PriceCreate,
                    key,
                )?;
                push_price(
                    state,
                    key,
                    PriceAction::Object(ObjectAction::Created(price.id)),
                );
            }
            PriceDecision::Create(_) => {
                push_price(state, key, PriceAction::Object(ObjectAction::WouldCreate));
            }
            PriceDecision::Update { id, input } if apply => {
                provider_result(
                    self.catalogue_provider.update_price(&id, &input),
                    ProviderOperation::PriceUpdate,
                    &id,
                )?;
                push_price(state, key, PriceAction::Object(ObjectAction::Updated(id)));
            }
            PriceDecision::Update { id, .. } => {
                push_price(
                    state,
                    key,
                    PriceAction::Object(ObjectAction::WouldUpdate(id)),
                );
            }
            PriceDecision::Validated { id } => {
                push_price(state, key, PriceAction::Object(ObjectAction::Validated(id)));
            }
            PriceDecision::Replace {
                predecessor,
                repair,
                fields,
            } if apply => {
                if let Some(input) = repair {
                    provider_result(
                        self.catalogue_provider.update_price(&predecessor, &input),
                        ProviderOperation::PriceUpdate,
                        &predecessor,
                    )?;
                    push_price(
                        state,
                        key,
                        PriceAction::Object(ObjectAction::Updated(predecessor.clone())),
                    );
                }
                let input = fields.create_input(state.run.clone(), product_id, Some(&predecessor));
                let replacement = provider_result(
                    self.catalogue_provider.create_price(&input),
                    ProviderOperation::PriceReplace,
                    &predecessor,
                )?;
                push_price(
                    state,
                    key,
                    PriceAction::Replaced {
                        old: predecessor.clone(),
                        new: replacement.id,
                    },
                );
            }
            PriceDecision::Replace {
                predecessor,
                repair,
                ..
            } => {
                if repair.is_some() {
                    push_price(
                        state,
                        key,
                        PriceAction::Object(ObjectAction::WouldUpdate(predecessor.clone())),
                    );
                }
                push_price(state, key, PriceAction::WouldReplace(predecessor));
            }
        }
        Ok(())
    }
}

fn push_price(state: &mut RunState, key: &str, action: PriceAction) {
    state.lines.push(ReportLine::Price {
        key: key.to_owned(),
        action,
    });
}
