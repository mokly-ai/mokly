//! In-memory graph fixture fills its queued encoded budget before route zero ends.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, mpsc};

use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_catalogue::html_input::DeliveredHtml;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_graph::cache::MemoryCache;
use mokly_graph::capture_window::CaptureConsumer;
use mokly_graph::delivery_inputs::DeliveryInputs;
use mokly_graph::graph::Graph;
use mokly_graph::types::{RenderGeneration, RenderGraph};
use mokly_graph::workers::{RenderWorkers, RenderWorkersMock, ThreadWorkers};
use mokly_html::composition::{Composed, ComposerMock};
use mokly_html::parse;
use mokly_model::axes::ColorScheme;
use mokly_model::catalogue::{CatalogueModel, EntryContent, ModelEntry};
use mokly_model::usage::CatalogueUsage;
use mokly_source_interface::tree::SourceTreeMock;
use serde_json::json;
use unimock::{MockFn, Unimock, matching};

pub(super) struct Fixture {
    pub(super) generation: Arc<dyn RenderGeneration>,
    pub(super) filled: Arc<AtomicBool>,
}

struct ReleaseAfter<'a> {
    inner: &'a mut dyn CaptureConsumer,
    release: &'a mpsc::Sender<()>,
    pending: &'a AtomicBool,
    filled: &'a AtomicBool,
}

impl CaptureConsumer for ReleaseAfter<'_> {
    fn admit(&mut self, index: usize) -> bool {
        self.inner.admit(index)
    }
    fn complete(&mut self, index: usize) -> bool {
        let released = self.inner.complete(index);
        if index == 3 {
            self.filled.store(
                self.pending.load(Ordering::SeqCst) && released,
                Ordering::SeqCst,
            );
            self.release.send(()).unwrap();
        }
        released
    }
}

fn body(length: usize, mut seed: u32) -> String {
    let mut body = String::with_capacity(length);
    for _ in 0..length {
        seed ^= seed << 13;
        seed ^= seed >> 17;
        seed ^= seed << 5;
        body.push(char::from(b'a' + (seed % 26) as u8));
    }
    body
}

pub(super) fn fixture(controlled: bool) -> Fixture {
    let pending = Arc::new(AtomicBool::new(false));
    let filled = Arc::new(AtomicBool::new(false));
    let (release, wait) = mpsc::channel();
    let wait = Mutex::new(wait);
    let (started, started_wait) = mpsc::channel();
    let started_wait = Mutex::new(started_wait);
    let pool: Arc<dyn RenderWorkers> = Arc::new(ThreadWorkers::new(2).unwrap());
    let workers: Arc<dyn RenderWorkers> = if controlled {
        let pending = pending.clone();
        let filled = filled.clone();
        Arc::new(Unimock::new((
            RenderWorkersMock::capture_parallelism
                .each_call(matching!())
                .returns(2_usize),
            RenderWorkersMock::capture_window
                .each_call(matching!(_, _, _))
                .answers_arc(Arc::new(move |_, limit, task, consumer| {
                    pool.capture_window(
                        limit,
                        task,
                        &mut ReleaseAfter {
                            inner: consumer,
                            release: &release,
                            pending: &pending,
                            filled: &filled,
                        },
                    );
                })),
        )))
    } else {
        pool
    };
    let composer = Arc::new(Unimock::new(ComposerMock::compose.each_call(matching!(_))
        .answers_arc(Arc::new(move |_, request| {
            let index: usize = request.entry.metadata.path.parse().unwrap();
            if controlled {
                match index {
                    0 => {
                        pending.store(true, Ordering::SeqCst);
                        started.send(()).unwrap();
                        wait.lock().unwrap().recv().unwrap();
                        pending.store(false, Ordering::SeqCst);
                    }
                    1 => started_wait.lock().unwrap().recv().unwrap(),
                    _ => {}
                }
            }
            let text = body([8192, 12288, 1024, 1024][index], index as u32 + 1);
            Ok(Composed {
                tree: parse::html(DeliveredHtml::document(&format!("<!doctype html><html><head><title>{index}</title></head><body><p>{text}</p></body></html>"))),
                usage: CatalogueUsage::Unavailable, warnings: vec![], resources: vec![], components: vec![], links: vec![],
            })
        }))));
    let entries: Vec<ModelEntry> = (0..4)
        .map(|index| {
            ModelEntry {
        metadata: serde_json::from_value(json!({
            "path": index.to_string(), "title": index.to_string(), "description": "", "tags": [],
            "relatedDocs": [], "isIndex": false, "rootIndex": 0,
            "source": { "path": format!("{index}.html"), "line": 1, "column": 1 },
        })).unwrap(), content: EntryContent::Page,
    }
        })
        .collect();
    let graph = Graph {
        inputs: DeliveryInputs::default(),
        tree: Arc::new(Unimock::new(
            SourceTreeMock::digest
                .each_call(matching!(_))
                .answers(&|_, path| Ok(path.to_string_lossy().into_owned())),
        )),
        composer,
        stylesheets: Arc::new(Unimock::new(())),
        cache: Arc::new(MemoryCache::new(0, 0)),
        workers,
        version: "test".into(),
    };
    let generation = graph
        .prepare(
            ResolvedConfig {
                input: Config::default(),
                repo_root: "/repo".into(),
                file: "/repo/mokly.config.json".into(),
                roots: vec![],
                modules: Default::default(),
                authored_inputs: vec![],
            },
            PreparedCatalogue {
                model: CatalogueModel {
                    folders: vec![],
                    color_schemes: vec![ColorScheme::Light],
                    entries,
                    sources: vec![],
                },
                inventory: Default::default(),
                javascript: Default::default(),
                dependency_directories: Default::default(),
                templates: Default::default(),
                documents: Default::default(),
                slot_fragments: Default::default(),
                elements: Default::default(),
                prop_validators: Default::default(),
                warnings: vec![],
            },
            None,
        )
        .unwrap();
    Fixture { generation, filled }
}
