//! Reused views move current checked usage into the current reduction working set.

use std::sync::atomic::Ordering;
use std::time::Instant;

use mokly_graph::types::RenderGeneration;
use mokly_model::catalogue::EntryContent;
use mokly_model::review_affected::ReviewSide;
use mokly_model::usage::CatalogueUsage;

use crate::comparison_address::address;
use crate::comparison_consumer::Consumer;
use crate::comparison_error::CompareResult;
use crate::comparison_routes::ViewRoutes;
use crate::comparison_views::{PairViews, UsageView};
use crate::error::Result;
use crate::reuse_probes::Probes;

pub(crate) fn collect(
    result: &mut PairViews,
    consumer: &Consumer<'_>,
    routes: &ViewRoutes,
    before: &dyn RenderGeneration,
    head: Option<CatalogueUsage>,
    probes: Option<&Probes>,
) -> Result<()> {
    let start = Instant::now();
    let outcome = (|| {
        if let (Some(entry), Some(route)) = (consumer.previous, routes.before.as_deref())
            && let Some(usage) = before.comparison_usage(route).compare()?
        {
            result.usage.push(UsageView {
                side: ReviewSide::Before,
                entry: address(entry),
                component: matches!(entry.content, EntryContent::Component { .. }),
                key: routes.key,
                usage,
            });
        }
        if let (Some(entry), Some(usage)) = (consumer.current, head) {
            result.usage.push(UsageView {
                side: ReviewSide::After,
                entry: address(entry),
                component: matches!(entry.content, EntryContent::Component { .. }),
                key: routes.key,
                usage,
            });
        }
        Ok(())
    })();
    if let Some(probes) = probes {
        probes
            .usage_nanos
            .fetch_add(start.elapsed().as_nanos() as u64, Ordering::Relaxed);
    }
    outcome
}
