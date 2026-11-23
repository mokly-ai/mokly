//! A view's own validated outputs share the optional arena, bound, and release of its fact.

use std::io::{self, Write};
use std::mem;
use std::sync::Arc;

use mokly_graph::comparison_proof::ContentIdentity;
use mokly_graph::head_validation::ValidationRead;
use mokly_graph::workers::ValidatedView;
use mokly_html::composition::Composed;
use mokly_html::links::Reference;
use mokly_model::usage::CatalogueUsage;

use crate::reuse_optional::Arena;
use crate::validation_facts::{Outputs, Read, warnings_bytes};
use crate::validation_head::Head;

impl Arena {
    /// Borrow the kept outputs of a route whose document key and policy are unchanged.
    pub(crate) fn outputs(&self, route: &str, key: ContentIdentity) -> Option<Arc<Outputs>> {
        let guard = self.data.read().unwrap_or_else(|error| error.into_inner());
        let outputs = guard
            .as_ref()?
            .outputs
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .get(route)?
            .clone();
        (outputs.key == key).then_some(outputs)
    }

    /// Share proven outputs into this attempt's arena for the next classification.
    pub(crate) fn keep_outputs(&self, route: &str, outputs: &Arc<Outputs>) {
        let guard = self.data.read().unwrap_or_else(|error| error.into_inner());
        let Some(data) = &*guard else {
            return;
        };
        if data
            .charge
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .grow(mem::size_of::<(Arc<str>, Arc<Outputs>)>() + route.len() + 320)
        {
            data.outputs
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .insert(Arc::from(route), outputs.clone());
        }
    }
}

impl Head {
    /// Keep the outputs of a view read from its current document, beside its kept fact.
    pub(crate) fn keep_validated(&self, route: &str, document: &Composed, view: &ValidatedView) {
        let Some(key) = self.key(route) else {
            return;
        };
        self.resident.with_optional([self.current, None], |arenas| {
            let Some(arena) = arenas[0] else {
                return;
            };
            if arena.fact(route, key).is_none() {
                return;
            }
            let mut reads: Vec<Arc<Read>> = Vec::new();
            for link in view.links.iter().filter(|link| link.fragment.is_some()) {
                if reads.iter().any(|read| *read.route == *link.target) {
                    continue;
                }
                let Some(read) = arena.input(
                    &self.resident,
                    self.generation.as_ref(),
                    ValidationRead::LinkTarget,
                    &link.target,
                    None,
                ) else {
                    return;
                };
                reads.push(read);
            }
            let Some(bytes) = outputs_bytes(view, document, &reads) else {
                return;
            };
            let Some(charge) = self
                .resident
                .reserve_optional(bytes + mem::size_of::<(Arc<str>, Arc<Outputs>)>() + 320)
            else {
                return;
            };
            let outputs = Arc::new(Outputs {
                key,
                anchors: view.anchors.clone(),
                links: view.links.clone(),
                warnings: document.warnings.clone(),
                usage: document.usage.clone(),
                reads,
                _charge: charge,
            });
            let guard = arena.data.read().unwrap_or_else(|error| error.into_inner());
            if let Some(data) = &*guard {
                data.outputs
                    .lock()
                    .unwrap_or_else(|error| error.into_inner())
                    .insert(Arc::from(route), outputs);
            }
        });
    }
}

fn outputs_bytes(view: &ValidatedView, document: &Composed, reads: &[Arc<Read>]) -> Option<usize> {
    let anchors = view
        .anchors
        .iter()
        .map(|anchor| mem::size_of::<String>() + 64 + anchor.len())
        .sum::<usize>();
    let links = view
        .links
        .iter()
        .map(|link| {
            mem::size_of::<Reference>()
                + link.source_route.len()
                + link.target.len()
                + link.fragment.as_ref().map_or(0, String::len)
        })
        .sum::<usize>();
    Some(
        mem::size_of::<Outputs>()
            + 64
            + anchors
            + links
            + warnings_bytes(&document.warnings)
            + usage_bytes(&document.usage)?
            + mem::size_of_val(reads),
    )
}

/// Usage records retain about twice their JSON length, as in the render cache charge.
fn usage_bytes(usage: &CatalogueUsage) -> Option<usize> {
    let mut counter = Counter(0);
    serde_json::to_writer(&mut counter, usage).ok()?;
    counter.0.checked_mul(2)
}

struct Counter(usize);

impl Write for Counter {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        self.0 = self.0.saturating_add(bytes.len());
        Ok(bytes.len())
    }
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}
