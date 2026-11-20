//! Price mutations exposed by the stateful Stripe double.

use mkc_domain::billing::PRICE_SEAT_KIND_METADATA;
use serde_json::Value;

use super::state::State;

impl State {
    pub(super) fn archive_price(&mut self, id: &str) -> Result<Value, String> {
        let Some(index) = self.prices.iter().position(|price| price.id == id) else {
            return Err(format!("unknown price archive target {id}"));
        };
        self.prices[index].active = false;
        self.price_json(&self.prices[index], false)
    }

    pub(super) fn update_price(
        &mut self,
        id: &str,
        nickname: &str,
        seat_kind: &str,
    ) -> Result<Value, String> {
        let Some(index) = self.prices.iter().position(|price| price.id == id) else {
            return Err(format!("unknown price update target {id}"));
        };
        self.prices[index].nickname = nickname.to_owned();
        self.prices[index]
            .metadata
            .insert(PRICE_SEAT_KIND_METADATA.to_owned(), seat_kind.to_owned());
        self.price_json(&self.prices[index], false)
    }
}
