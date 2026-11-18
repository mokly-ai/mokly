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
use crate::comparison_views::PendingView;
use crate::error::Result;
use crate::reuse_collection::Collection;
use crate::reuse_memo::RecordingMemo;
use crate::reuse_usage;

pub(crate) struct ViewStream<'a> {
    pub(crate) reuse: Option<&'a mut Collection>,
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
        if let Some(reused) = slot.reused {
            let result = &mut self.results[route.pair];
            result.warnings.extend(reused.warnings.iter().cloned());
            result.views.push(PendingView::new(reused.input.clone()));
            reuse_usage::collect(
                result,
                &self.consumers[route.pair],
                &route,
                self.before,
                slot.usage,
                self.reuse.as_ref().map(|reuse| reuse.probes.as_ref()),
            )?;
            if let (Some(reuse), Some(key)) = (&mut self.reuse, slot.key) {
                reuse.reused(key, reused);
            }
            return Ok(());
        }
        let prepared = match slot.input? {
            ViewInput::Ready(prepared) => prepared,
            ViewInput::Deferred(recipe) => Box::new(self.preparation.prepare(
                route.before.as_deref(),
                route.after.as_deref(),
                route.moved,
                recipe.map(RetainedComparisonInput::Deferred),
            )?),
        };
        let recorder = prepared.recorder.clone();
        if let Some(recorder) = &recorder {
            recorder.closure_union(
                self.before,
                self.after,
                [&prepared.resources.before, &prepared.resources.after],
            );
        }
        let original = &self.consumers[route.pair];
        let memo = recorder.as_ref().map(|recorder| RecordingMemo {
            inner: original.memo,
            before: self.before,
            after: self.after,
            recorder,
        });
        let recording = memo.as_ref().map(|memo| Consumer {
            moved: original.moved,
            previous: original.previous,
            current: original.current,
            component: original.component.clone(),
            paths: original.paths,
            memo,
        });
        let consumer: &dyn ViewConsumer = recording.as_ref().map_or(original, |consumer| consumer);
        let warnings = self.results[route.pair].warnings.len();
        consumer.consume(
            &mut self.results[route.pair],
            route.key,
            route.before,
            route.after,
            *prepared,
        )?;
        if let Some(reuse) = &mut self.reuse {
            let result = &self.results[route.pair];
            if let Some(view) = result.views.last() {
                reuse.compared(slot.key, view, &result.warnings[warnings..], recorder);
            }
        }
        Ok(())
    }
}

impl ComparisonConsumer for ViewStream<'_> {
    fn admit(&mut self, index: usize) -> bool {
        let Some(route) = self.routes.next() else {
            return false;
        };
        if let Some(reuse) = &mut self.reuse {
            let key = reuse.key(&route, &self.consumers[route.pair]);
            let previous = key.as_ref().and_then(|key| reuse.lookup(key));
            self.slots.admit_reuse(index, route, key, previous);
        } else {
            self.slots.admit(index, route);
        }
        true
    }

    fn consume(&mut self, index: usize) -> bool {
        self.outcome = self.consume_view(index);
        self.outcome.is_ok()
    }
}
