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
use crate::stylesheet_capture::{Capture, RecordingTree};
use crate::stylesheet_watch;

pub(crate) struct Compilation {
    pub(crate) bundle: Bundle,
    pub(crate) capture: Capture,
}

#[cfg_attr(test, unimock::unimock(api = [CompileRoot, WatchFiles]))]
pub(crate) trait RootCompiler: Send + Sync {
    fn compile(&self, root: &StylesheetRoot) -> Result<Compilation>;
    fn watch_files(&self, files: &BTreeSet<String>) -> Result<WatchInputs> {
        Ok(WatchInputs {
            files: files.clone(),
            ..WatchInputs::default()
        })
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
