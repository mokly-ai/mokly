//! Ordered caller policy shares only bounded preparation slots with workers.

use mokly_graph::comparison_input::RetainedComparisonInput;
use mokly_graph::comparison_stream::ComparisonConsumer;
use mokly_graph::types::RenderGeneration;

use crate::comparison_consumer::{Consumer, ViewConsumer};
use crate::comparison_error::CompareResult;
use crate::comparison_preparation::{ViewInput, ViewPreparation};
use crate::comparison_routes::ViewRoutes;
use crate::comparison_slots::Slots;
use crate::comparison_views::PairViews;
use crate::error::Result;

pub(crate) struct ViewStream<'a> {
    pub(crate) routes: Box<dyn Iterator<Item = ViewRoutes> + 'a>,
    pub(crate) slots: &'a Slots<'a>,
    pub(crate) preparation: &'a dyn ViewPreparation,
    pub(crate) before: &'a dyn RenderGeneration,
    pub(crate) after: &'a dyn RenderGeneration,
    pub(crate) consumers: &'a [Consumer<'a>],
    pub(crate) results: &'a mut [PairViews],
    pub(crate) outcome: Result<()>,
}

impl ViewStream<'_> {
    fn consume_view(&mut self, index: usize) -> Result<()> {
        self.before.check_cancelled().compare()?;
        self.after.check_cancelled().compare()?;
        let slot = self.slots.take(index)?;
        let route = slot.routes;
        let prepared = match slot.input? {
            ViewInput::Ready(prepared) => prepared,
            ViewInput::Deferred(recipe) => Box::new(self.preparation.prepare(
                route.before.as_deref(),
                route.after.as_deref(),
                route.moved,
                recipe.map(RetainedComparisonInput::Deferred),
            )?),
        };
        let consumer: &dyn ViewConsumer = &self.consumers[route.pair];
        consumer.consume(
            &mut self.results[route.pair],
            route.key,
            route.before,
            route.after,
            *prepared,
        )
    }
}

impl ComparisonConsumer for ViewStream<'_> {
    fn admit(&mut self, index: usize) -> bool {
        let Some(route) = self.routes.next() else {
            return false;
        };
        self.slots.admit(index, route);
        true
    }

    fn consume(&mut self, index: usize) -> bool {
        self.outcome = self.consume_view(index);
        self.outcome.is_ok()
    }
}
