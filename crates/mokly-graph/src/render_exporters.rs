//! Indexed exporter jobs share immutable records and retain only finished keys.

use std::collections::BTreeMap;
use std::sync::Mutex;

use crate::key::NodeKey;
use crate::render_closure::{Parts, Records, additional};
use crate::workers::{ComparisonTask, RenderWorkers};

/// Run the same exporter calculation sequentially or on the supplied workers.
pub(crate) fn build(
    graph: &BTreeMap<String, Vec<String>>,
    records: &Records<'_>,
    shared: &str,
    exporters: Vec<(&str, &Parts<'_>)>,
    workers: Option<&dyn RenderWorkers>,
) -> BTreeMap<String, NodeKey> {
    let task = ExporterKeys {
        graph,
        records,
        shared,
        exporters,
        modules: Mutex::new(BTreeMap::new()),
    };
    let count = task.exporters.len();
    if count != 0 {
        match workers {
            Some(workers) => workers.comparison_tasks(count, &task),
            None => {
                for index in 0..count {
                    task.run(index);
                }
            }
        }
    }
    task.modules
        .into_inner()
        .unwrap_or_else(|error| error.into_inner())
}

struct ExporterKeys<'a> {
    graph: &'a BTreeMap<String, Vec<String>>,
    records: &'a Records<'a>,
    shared: &'a str,
    exporters: Vec<(&'a str, &'a Parts<'a>)>,
    modules: Mutex<BTreeMap<String, NodeKey>>,
}

impl ComparisonTask for ExporterKeys<'_> {
    fn run(&self, index: usize) {
        let (module, common) = self.exporters[index];
        let key = {
            let extra =
                self.records
                    .parts(additional(self.graph, [module.to_owned()], &common.members));
            common.key(&extra, self.shared)
        };
        self.modules
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .insert(module.to_owned(), key);
    }
}
