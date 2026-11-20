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
use mokly_source_interface::tree::SourceTree;

use crate::postcss::PostCss;
use crate::side::SideInputs;
use crate::stylesheet_capture::{Capture, RecordingTree};
use crate::stylesheet_watch;

pub(crate) struct Compilation {
    pub(crate) bundle: Bundle,
    pub(crate) capture: Capture,
}

#[cfg_attr(test, unimock::unimock(api = [CompileRoot, WatchFiles]))]
pub(crate) trait RootCompiler: Send + Sync {
    fn compile(&self, root: &StylesheetRoot) -> Result<Compilation>;
    fn watch_files(&self, files: &BTreeSet<String>) -> Result<BTreeSet<String>> {
        Ok(files.clone())
    }
}

pub(crate) struct CapturingCompiler {
    pub(crate) tree: Arc<dyn SourceTree>,
    pub(crate) root: PathBuf,
    pub(crate) resolution: Resolution,
    pub(crate) postcss: Option<Arc<PostCss>>,
    pub(crate) watch_sources: Option<Arc<dyn SourceTree>>,
    pub(crate) side: SideInputs,
}

impl RootCompiler for CapturingCompiler {
    fn compile(&self, root: &StylesheetRoot) -> Result<Compilation> {
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
        let compiler: &dyn StylesheetBundler = &Compiler {
            tree: tree.clone(),
            repo_root: self.root.clone(),
            resolver,
            processor,
        };
        let mut bundle = compiler.bundle(root)?;
        let capture = tree.take();
        bundle.resolution_files = capture
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
            })
            .collect();
        Ok(Compilation { bundle, capture })
    }
    fn watch_files(&self, files: &BTreeSet<String>) -> Result<BTreeSet<String>> {
        match &self.watch_sources {
            Some(sources) => {
                stylesheet_watch::files(files, &self.root, &self.side, sources.as_ref())
            }
            None => Ok(BTreeSet::new()),
        }
    }
}
