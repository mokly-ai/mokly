//! Small plain-CSS compilations and unimock boundaries for class-map services.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::{Arc, Mutex};

use mokly_css::error::Result;
use mokly_css::types::{Bundle, StylesheetRoot};
use mokly_css::watch_inputs::WatchInputs;
use mokly_source_interface::read_evidence::ReadBaseline;
use mokly_source_interface::tree::{SourceTree, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::dependency_usage::DependencyUsage;
use crate::stylesheet_cache::CachedStylesheets;
use crate::stylesheet_capture::Capture;
use crate::stylesheet_compiler::{
    Compilation, CompileRoot, DeferredCompiler, RootCompiler, WatchFiles,
};
use crate::stylesheet_store::StylesheetCache;
use crate::stylesheet_usage::BufferedUsage;

pub(super) type Script =
    dyn Fn(&StylesheetRoot, &dyn DependencyUsage) -> Result<Compilation> + Send + Sync;
pub(super) type Watch = dyn Fn(&BTreeSet<String>) -> Result<WatchInputs> + Send + Sync;

pub(super) fn roots(count: usize) -> Vec<StylesheetRoot> {
    (0..count)
        .map(|index| StylesheetRoot {
            path: format!("r{index}.css"),
            stylesheets: vec![format!("r{index}.css")],
            excluded: BTreeSet::new(),
            local_css: false,
        })
        .collect()
}

pub(super) fn key(root: &StylesheetRoot) -> String {
    format!("settings:{root:?}")
}

pub(super) fn compiled(root: &StylesheetRoot) -> Compilation {
    let mut capture = Capture::default();
    capture.evidence.insert(
        root.path.clone(),
        ReadBaseline::ObservedWholeFile("hash".into()),
    );
    Compilation {
        capture,
        bundle: Bundle {
            resolution_files: BTreeSet::from([root.path.clone()]),
            resolution_roots: BTreeMap::new(),
            read_evidence: Default::default(),
            route: format!("styles/{}", root.path),
            css: "x".repeat(4096),
            assets: BTreeMap::new(),
            css_module_named_exports: Default::default(),
            css_modules: BTreeMap::from([(
                "shared.module.css".into(),
                BTreeMap::from([("name".into(), root.path.clone())]),
            )]),
            inputs: BTreeMap::new(),
            imported_by: BTreeMap::new(),
            repository_aliases: BTreeSet::new(),
            dependency_digests: BTreeMap::new(),
            plugin_inputs: BTreeMap::new(),
            directories: Vec::new(),
        },
    }
}

pub(super) fn tree(events: Arc<Mutex<Vec<String>>>) -> Arc<dyn SourceTree> {
    Arc::new(Unimock::new(
        SourceTreeMock::observe_inputs
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, path, versions| {
                assert_eq!(
                    *versions,
                    BTreeSet::from([ReadBaseline::ObservedWholeFile("hash".into())])
                );
                events
                    .lock()
                    .unwrap()
                    .push(format!("observe:{}", path.display()));
                Ok(())
            })),
    ))
}

pub(super) fn watch(events: Arc<Mutex<Vec<String>>>) -> Arc<Watch> {
    Arc::new(move |files| {
        events
            .lock()
            .unwrap()
            .push(format!("watch:{}", files.first().unwrap()));
        Ok(WatchInputs {
            files: files.clone(),
            ..Default::default()
        })
    })
}

pub(super) fn inner(
    script: Arc<Script>,
    usage: Arc<dyn DependencyUsage>,
    watch: Arc<Watch>,
    plain: bool,
) -> Arc<dyn RootCompiler> {
    Arc::new(ForkingCompiler {
        script,
        usage,
        watch,
        plain,
    })
}

struct ForkingCompiler {
    script: Arc<Script>,
    usage: Arc<dyn DependencyUsage>,
    watch: Arc<Watch>,
    plain: bool,
}

impl RootCompiler for ForkingCompiler {
    fn compile(&self, root: &StylesheetRoot) -> Result<Compilation> {
        let script = self.script.clone();
        let usage = self.usage.clone();
        Unimock::new(
            CompileRoot
                .some_call(matching!(_))
                .answers_arc(Arc::new(move |_, root| script(root, usage.as_ref()))),
        )
        .compile(root)
    }

    fn watch_files(&self, files: &BTreeSet<String>) -> Result<WatchInputs> {
        let watch = self.watch.clone();
        Unimock::new(
            WatchFiles
                .some_call(matching!(_))
                .answers_arc(Arc::new(move |_, files| watch(files))),
        )
        .watch_files(files)
    }

    fn deferred(&self) -> Option<DeferredCompiler> {
        self.plain.then(|| {
            let usage = Arc::new(BufferedUsage::new(self.usage.clone()));
            DeferredCompiler {
                compiler: inner(
                    self.script.clone(),
                    usage.clone(),
                    self.watch.clone(),
                    false,
                ),
                usage,
            }
        })
    }
}

pub(super) fn attempt(
    inner: Arc<dyn RootCompiler>,
    tree: Arc<dyn SourceTree>,
    shared: &Arc<Mutex<StylesheetCache>>,
) -> CachedStylesheets {
    CachedStylesheets::new(
        inner,
        tree,
        "/repo".into(),
        "settings".into(),
        shared.clone(),
    )
}

pub(super) fn maps(value: &str) -> BTreeMap<String, BTreeMap<String, String>> {
    BTreeMap::from([(
        "shared.module.css".into(),
        BTreeMap::from([("name".into(), value.into())]),
    )])
}
