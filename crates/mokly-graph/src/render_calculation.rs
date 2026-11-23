//! Full calculations return worker results directly; edit calculations reuse completed facts.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::OnceLock;

use crate::key::NodeKey;
use crate::render_closure::{Parts, closure};
use crate::render_exporters;
use crate::render_inputs::{RenderInputs, RenderKeys};
use crate::render_preparation::Prepared;
use crate::render_reuse::Facts;
use crate::workers::RenderWorkers;

/// Reuse evidence belongs only to Serve keys, with startup initialization deferred.
#[derive(Clone, Copy)]
pub(crate) enum Mode<'a> {
    /// Ordinary and historical full calculation, with no fact cell.
    Full,
    /// Full Serve startup calculation, with an empty fact cell.
    Deferred,
    /// Edit calculation with optional completed preceding facts.
    Reuse(Option<&'a RenderKeys>),
}

/// Only finished keys and optional current facts survive calculation.
pub(crate) struct Built {
    /// Current eligible exporters and their complete canonical keys.
    pub(crate) modules: BTreeMap<String, NodeKey>,
    /// An empty startup cell or completed current edit facts.
    pub(crate) reuse: Option<Box<OnceLock<Option<Facts>>>>,
}

/// Run full jobs directly or compare current facts with a completed predecessor.
pub(crate) fn build(
    inputs: &RenderInputs<'_>,
    workers: Option<&dyn RenderWorkers>,
    mode: Mode<'_>,
) -> serde_json::Result<Built> {
    let graph = &inputs.generation.modules;
    let prepared = Prepared::new(inputs)?;
    let (renderer, preview) = common(&prepared, graph);
    let Mode::Reuse(previous) = mode else {
        let jobs = prepared
            .exporters()
            .map(|(module, story)| (module, if story { &preview } else { &renderer }))
            .collect::<Vec<_>>();
        tracing::Span::current().record("recomputed", jobs.len());
        tracing::Span::current().record("reused", 0);
        return Ok(Built {
            modules: render_exporters::build(
                graph,
                &prepared.records,
                &prepared.shared,
                jobs,
                workers,
            ),
            reuse: matches!(mode, Mode::Deferred).then(|| Box::new(OnceLock::new())),
        });
    };
    let facts = Facts::new(&prepared, &renderer, &preview)?;
    let reuse = previous.and_then(|keys| Some((keys, keys.completed_facts()?)));
    let (same_renderer, same_preview) = reuse.map_or((false, false), |(_, before)| {
        (
            facts.same_common(before, false),
            facts.same_common(before, true),
        )
    });
    let affected = if same_renderer || same_preview {
        reuse.map_or_else(BTreeSet::new, |(_, before)| facts.affected(before, graph))
    } else {
        BTreeSet::new()
    };
    let mut modules = BTreeMap::new();
    let mut jobs = Vec::new();
    for (module, story) in prepared.exporters() {
        if let Some((previous, before)) = reuse
            && !affected.contains(module)
            && (if story { same_preview } else { same_renderer })
            && facts.same_mode(before, module)
            && let Some(key) = previous.keyed(module)
        {
            modules.insert(module.to_owned(), key.clone());
        } else {
            jobs.push((module, if story { &preview } else { &renderer }));
        }
    }
    tracing::Span::current().record("reused", modules.len());
    tracing::Span::current().record("recomputed", jobs.len());
    modules.extend(render_exporters::build(
        graph,
        &prepared.records,
        &prepared.shared,
        jobs,
        workers,
    ));
    Ok(Built {
        modules,
        reuse: Some(Box::new(OnceLock::from(Some(facts)))),
    })
}

/// Recreate temporary full-algorithm records without scheduling an exporter job.
pub(crate) fn facts(inputs: &RenderInputs<'_>) -> serde_json::Result<Facts> {
    let prepared = Prepared::new(inputs)?;
    let (renderer, preview) = common(&prepared, &inputs.generation.modules);
    Facts::new(&prepared, &renderer, &preview)
}

fn common<'a>(
    prepared: &'a Prepared<'_>,
    graph: &BTreeMap<String, Vec<String>>,
) -> (Parts<'a>, Parts<'a>) {
    let renderer = prepared.records.parts(
        prepared
            .renderer
            .map_or_else(BTreeSet::new, |root| closure(graph, [root.to_owned()])),
    );
    let preview = prepared.records.parts(
        prepared
            .preview
            .map_or_else(BTreeSet::new, |root| closure(graph, [root.to_owned()])),
    );
    (renderer, preview)
}
