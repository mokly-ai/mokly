//! Each root gets a recording tree and resolver while PostCSS keeps its attempt state.

use std::collections::BTreeSet;
use std::path::PathBuf;
use std::sync::Arc;

use mokly_css::compiler::Compiler;
use mokly_css::error::Result;
use mokly_css::resolution::Resolution;
use mokly_css::resolver::{ImportResolver, SourceResolver};
use mokly_css::types::{
    Bundle, CssProcessor, IdentityProcessor, StylesheetBundler, StylesheetRoot,
};
use mokly_css::vite::{self, Transform};
use mokly_css::watch_inputs::WatchInputs;
use mokly_source_interface::tree::SourceTree;

use crate::postcss::PostCss;
use crate::side::SideInputs;
use crate::sources::SideTree;
use crate::stylesheet_capture::{Capture, RecordingTree};
use crate::stylesheet_class_maps::ClassMapCompiler;
use crate::stylesheet_usage::BufferedUsage;
use crate::stylesheet_watch;

pub(crate) struct Compilation {
    pub(crate) bundle: Bundle,
    pub(crate) capture: Capture,
}

/// A raw compiler fork and its usage buffer remain owned until ordered delivery.
pub(crate) struct DeferredCompiler {
    /// A plain-CSS compiler whose reads affect only this root's usage buffer.
    pub(crate) compiler: Arc<dyn RootCompiler>,
    /// Captured usage also survives a raw compiler failure or unwind.
    pub(crate) usage: Arc<BufferedUsage>,
}

#[cfg_attr(test, unimock::unimock(api = [CompileRoot, WatchFiles, DeferRoot]))]
pub(crate) trait RootCompiler: Send + Sync {
    fn compile(&self, root: &StylesheetRoot) -> Result<Compilation>;
    fn watch_files(&self, files: &BTreeSet<String>) -> Result<WatchInputs> {
        Ok(WatchInputs {
            files: files.clone(),
            ..WatchInputs::default()
        })
    }
    /// Only a plain-CSS compiler with a replaceable usage collector can fork.
    fn deferred(&self) -> Option<DeferredCompiler> {
        None
    }
}

/// Attempt-local stylesheet reuse also identifies useful PostCSS preparation.
pub(crate) trait StylesheetPreparation: ClassMapCompiler {
    /// A retained PostCSS root whose current evidence rejects reuse.
    fn stale_postcss(&self) -> bool;
    /// Every compiled or reused root remains in this attempt's bounded store.
    fn kept_every_record(&self) -> bool;
}

pub(crate) struct CapturingCompiler {
    pub(crate) tree: Arc<dyn SourceTree>,
    pub(crate) root: PathBuf,
    pub(crate) resolution: Resolution,
    pub(crate) postcss: Option<Arc<PostCss>>,
    pub(crate) watch_sources: Option<Arc<dyn SourceTree>>,
    pub(crate) side: SideInputs,
    /// Plain-CSS forks replace this side tree's usage without changing its snapshots.
    pub(crate) deferred_sources: Option<Arc<SideTree>>,
}

impl RootCompiler for CapturingCompiler {
    fn deferred(&self) -> Option<DeferredCompiler> {
        if self.postcss.is_some() {
            return None;
        }
        let mut sources = self.deferred_sources.as_deref()?.clone();
        let usage = Arc::new(BufferedUsage::new(sources.usage.clone()));
        sources.usage = usage.clone();
        Some(DeferredCompiler {
            compiler: Arc::new(Self {
                tree: Arc::new(sources),
                root: self.root.clone(),
                resolution: self.resolution.clone(),
                postcss: None,
                watch_sources: self.watch_sources.clone(),
                side: self.side.clone(),
                deferred_sources: None,
            }),
            usage,
        })
    }

    fn compile(&self, root: &StylesheetRoot) -> Result<Compilation> {
        self.compile_with(root, None)
    }

    fn watch_files(&self, files: &BTreeSet<String>) -> Result<WatchInputs> {
        match &self.watch_sources {
            Some(sources) => {
                stylesheet_watch::files(files, &self.root, &self.side, sources.as_ref())
            }
            None => Ok(WatchInputs::default()),
        }
    }
}

pub(crate) struct ViteRootCompiler {
    pub(crate) base: CapturingCompiler,
    pub(crate) transform: Arc<dyn Transform>,
}

impl RootCompiler for ViteRootCompiler {
    fn compile(&self, root: &StylesheetRoot) -> Result<Compilation> {
        self.base.compile_with(root, Some(self.transform.as_ref()))
    }

    fn watch_files(&self, files: &BTreeSet<String>) -> Result<WatchInputs> {
        use crate::source_paths::INSTALLED_INPUT_PREFIX;

        self.base.watch_files(
            &files
                .iter()
                .map(|file| {
                    file.strip_prefix(INSTALLED_INPUT_PREFIX)
                        .unwrap_or(file)
                        .to_owned()
                })
                .collect(),
        )
    }
}

impl CapturingCompiler {
    fn compile_with(
        &self,
        root: &StylesheetRoot,
        transform: Option<&dyn Transform>,
    ) -> Result<Compilation> {
        let tree = Arc::new(RecordingTree::new(self.tree.clone(), self.root.clone()));
        let resolver: Arc<dyn ImportResolver> = Arc::new(SourceResolver {
            tree: tree.clone(),
            repo_root: self.root.clone(),
            settings: self.resolution.clone(),
        });
        let processor: Arc<dyn CssProcessor> = match &self.postcss {
            Some(postcss) => postcss.for_root(tree.clone(), resolver.clone()),
            None => Arc::new(IdentityProcessor),
        };
        let compiler = Compiler {
            tree: tree.clone(),
            repo_root: self.root.clone(),
            resolver,
            processor,
        };
        let mut bundle = match transform {
            Some(transform) => {
                let bundle = vite::bundle(&compiler, root, transform)?;
                for path in &bundle.resolution_files {
                    let _ = tree.digest(&self.root.join(path));
                }
                bundle
            }
            None => compiler.bundle(root)?,
        };
        let capture = tree.take();
        bundle.resolution_files.extend(
            capture
                .stamp
                .files
                .keys()
                .chain(capture.stamp.unretained.keys())
                .chain(capture.stamp.projections.keys())
                .map(|path| {
                    path.strip_prefix(&self.root)
                        .unwrap_or(path)
                        .to_string_lossy()
                        .replace('\\', "/")
                }),
        );
        Ok(Compilation { bundle, capture })
    }
}

#[cfg(test)]
#[path = "_tests_/stylesheet_watch_tests.rs"]
mod stylesheet_watch_tests;

#[cfg(test)]
#[path = "_tests_/stylesheet_deferred_tests.rs"]
mod stylesheet_deferred_tests;
