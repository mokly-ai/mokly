//! Shared stylesheet cache fixtures: a PostCSS context with 551 module files and a counted tree.

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use mokly_css::types::{Bundle, StylesheetBundler, StylesheetBundlerMock, StylesheetRoot};
use mokly_source_interface::error::Result;
use mokly_source_interface::read_evidence::{FileIdentity, ReadBaseline, ReadEvidence};
use mokly_source_interface::tree::{Child, FileKind, Node, SourceTree};
use unimock::{MockFn, Unimock, matching};

use crate::source_paths::SOURCE_INPUT_PREFIX;
use crate::stylesheet_cache::CachedStylesheets;
use crate::stylesheet_record::{ContextEvidence, Record};
use crate::stylesheet_store::StylesheetCache;

pub(super) const MODULES: usize = 551;
pub(super) const DIGEST: &str = "0000000000000000000000000000000000000000000000000000000000000000";
const OBJECT: &str = "device-2049-inode-1234567";

pub(super) fn module(index: usize) -> String {
    format!(
        "node_modules/.pnpm/postcss-plugin@1.0.0/node_modules/postcss-plugin/lib/module-{index:03}.js"
    )
}

pub(super) fn root(path: &str) -> StylesheetRoot {
    StylesheetRoot {
        path: path.into(),
        stylesheets: vec![path.into()],
        excluded: BTreeSet::new(),
        local_css: true,
    }
}

pub(super) fn roots(count: usize) -> Vec<StylesheetRoot> {
    (0..count)
        .map(|index| root(&format!("root-{index:02}.css")))
        .collect()
}

pub(super) fn key(root: &StylesheetRoot) -> String {
    format!("settings:{root:?}")
}

/// One PostCSS result: each module of the context read with its identity, and the root's own
/// source. The CSS and source sizes make a record weigh about what an example record weighs.
pub(super) fn bundle(root: &StylesheetRoot) -> Bundle {
    let mut evidence = ReadEvidence::default();
    for index in 0..MODULES {
        evidence.insert(module(index), ReadBaseline::Late(DIGEST.into()));
        evidence.insert(
            module(index),
            ReadBaseline::ObservedFile {
                digest: DIGEST.into(),
                identity: FileIdentity {
                    object: OBJECT.into(),
                    canonical: Some(Path::new("/repo").join(module(index))),
                },
            },
        );
    }
    evidence.insert(
        format!("{SOURCE_INPUT_PREFIX}{}", root.path),
        ReadBaseline::Late(DIGEST.into()),
    );
    Bundle {
        read_evidence: evidence,
        route: format!("styles/{}", root.path),
        css: format!(".{} {{}}\n{}", root.path, "a{color:red}\n".repeat(12_000)),
        assets: BTreeMap::new(),
        css_modules: BTreeMap::new(),
        inputs: BTreeMap::from([(root.path.clone(), vec![b'a'; 160_000])]),
        imported_by: BTreeMap::new(),
        repository_aliases: BTreeSet::new(),
        dependency_digests: BTreeMap::new(),
        plugin_inputs: BTreeMap::new(),
        directories: Vec::new(),
    }
}

/// The delivered parts of two bundles are equal.
pub(super) fn assert_same(actual: &Bundle, expected: &Bundle) {
    assert_eq!(actual.route, expected.route);
    assert_eq!(actual.css, expected.css);
    assert_eq!(actual.inputs, expected.inputs);
    assert_eq!(actual.read_evidence, expected.read_evidence);
}

/// The tree calls of one attempt.
#[derive(Default)]
pub(super) struct Calls {
    pub(super) module_digests: AtomicUsize,
    pub(super) other_digests: AtomicUsize,
    pub(super) identities: AtomicUsize,
    pub(super) observed: Mutex<Vec<(PathBuf, BTreeSet<ReadBaseline>)>>,
}

impl Calls {
    pub(super) fn count(counter: &AtomicUsize) -> usize {
        counter.load(Ordering::SeqCst)
    }
}

/// A tree whose files all have `DIGEST`, except the files whose names end with an entry of
/// `changed`. It counts digests, identities, and observations.
struct CountedTree {
    calls: Arc<Calls>,
    changed: &'static [&'static str],
}

impl SourceTree for CountedTree {
    fn file_object(&self, _path: &Path) -> Result<Option<String>> {
        self.calls.identities.fetch_add(1, Ordering::SeqCst);
        Ok(Some(OBJECT.into()))
    }
    fn observe_inputs(&self, path: &Path, baselines: &BTreeSet<ReadBaseline>) -> Result<()> {
        let mut observed = self.calls.observed.lock().unwrap();
        observed.push((path.into(), baselines.clone()));
        Ok(())
    }
    fn project(&self, path: &Path) -> Result<Option<Node>> {
        Ok(Some(Node {
            identity: path.into(),
            lexical_kind: FileKind::File,
            kind: FileKind::File,
        }))
    }
    fn children(&self, _path: &Path) -> Result<Vec<Child>> {
        Ok(Vec::new())
    }
    fn read(&self, _path: &Path) -> Result<Vec<u8>> {
        Ok(Vec::new())
    }
    fn digest(&self, path: &Path) -> Result<String> {
        let name = path.to_string_lossy();
        let counter = match name.contains("/postcss-plugin/") {
            true => &self.calls.module_digests,
            false => &self.calls.other_digests,
        };
        counter.fetch_add(1, Ordering::SeqCst);
        Ok(match self.changed.iter().any(|file| name.ends_with(file)) {
            true => "1".repeat(64),
            false => DIGEST.into(),
        })
    }
}

pub(super) fn tree(calls: &Arc<Calls>, changed: &'static [&'static str]) -> Arc<dyn SourceTree> {
    Arc::new(CountedTree {
        calls: calls.clone(),
        changed,
    })
}

pub(super) fn attempt(
    inner: Arc<dyn StylesheetBundler>,
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

/// An inner bundler that counts its bundles and answers with `bundle`.
pub(super) fn bundler(calls: Arc<AtomicUsize>) -> Arc<dyn StylesheetBundler> {
    Arc::new(Unimock::new(
        StylesheetBundlerMock::bundle
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, root| {
                calls.fetch_add(1, Ordering::SeqCst);
                Ok(bundle(root))
            })),
    ))
}

/// Bundle `roots` in a first attempt over `shared`.
pub(super) fn fill(shared: &Arc<Mutex<StylesheetCache>>, roots: &[StylesheetRoot]) {
    let first = attempt(bundler(Arc::default()), tree(&Arc::default(), &[]), shared);
    for root in roots {
        first.bundle(root).unwrap();
    }
}

/// The charge of one record without its context entry, and the charge of that entry.
pub(super) fn charges(tree: &Arc<dyn SourceTree>) -> (usize, usize) {
    let root = Path::new("/repo");
    let record = Record::new(
        tree.as_ref(),
        root,
        bundle(&self::root("root-00.css")),
        |digest, evidence| Arc::new(ContextEvidence::new(tree.as_ref(), root, digest, evidence)),
    );
    let context = record.context.as_ref().map_or(0, |context| context.bytes);
    (record.bytes, context)
}
