//! One generation's cached public-file decisions over injected source trees.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::result;
use std::sync::{Arc, Mutex};

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::protection::{ProtectedBy, SourcePolicy};
use mokly_css::dependencies::PluginInput;
use mokly_source_interface::tree::{FileKind, SourceTree};

use crate::error::{Result, invalid};
use crate::public_denial::PublicDenial;

/// Accepted authored closure member; membership grants no read-time exception.
#[derive(Clone, Debug)]
pub struct PublicFile {
    /// Repository-relative logical path.
    pub path: String,
    /// Confined tree-local read path.
    pub absolute: PathBuf,
}

/// Generation-scoped public eligibility boundary.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = PublicPolicyMock))]
pub trait PublicPolicy: Send + Sync {
    /// Decide once per normalized path per generation; return a portable denial.
    fn check(&self, path: &str) -> result::Result<PublicFile, PublicDenial>;
}

/// Public policy with cached accepted and rejected decisions.
pub struct FilePolicy {
    /// Source access is always injected.
    pub tree: Arc<dyn SourceTree>,
    /// Source-tree repository identity.
    pub repo_root: PathBuf,
    /// Root matches and inventoried sources, with their precedence.
    pub sources: SourcePolicy,
    /// Specific imported-by diagnostics, after ordinary source precedence.
    pub imported_by: BTreeMap<String, String>,
    /// Consumer plugin sources keep their own recovery message.
    pub plugin_inputs: BTreeMap<String, PluginInput>,
    /// Private dependency, package, and actual output trees.
    pub private: Vec<PathBuf>,
    decisions: Mutex<BTreeMap<String, result::Result<PublicFile, PublicDenial>>>,
}

impl FilePolicy {
    /// Construct one policy after the generation's full source inventory exists.
    pub fn new(
        tree: Arc<dyn SourceTree>,
        config: &ResolvedConfig,
        sources: &[String],
        imported_by: BTreeMap<String, String>,
        output: Option<&Path>,
    ) -> Result<Self> {
        let policy = match SourcePolicy::new(config, sources) {
            Ok(policy) => policy,
            Err(source) => return Err(invalid("configuration", source.to_string())),
        };
        let mut private = Vec::new();
        if let Some(output) = output.filter(|output| output.starts_with(&config.repo_root)) {
            private.push(output.into());
        }
        if let Some(roots) = config
            .input
            .module_resolution
            .as_ref()
            .and_then(|resolution| resolution.package_roots.as_ref())
        {
            for root in roots {
                let path = config.file.parent().unwrap_or(&config.repo_root).join(root);
                if path != config.repo_root {
                    private.push(path);
                }
            }
        }
        Ok(Self {
            tree,
            repo_root: config.repo_root.clone(),
            sources: policy,
            imported_by,
            plugin_inputs: BTreeMap::new(),
            private,
            decisions: Mutex::new(BTreeMap::new()),
        })
    }

    /// Check a stylesheet input through the same structural policy without granting public membership.
    /// The graph permits the root's own inventory listing only when it was not private before CSS collection.
    pub fn stylesheet_input(
        &self,
        path: &str,
        own_listing: bool,
    ) -> result::Result<(), PublicDenial> {
        self.decide(path, own_listing).map(|_| ())
    }

    fn resolved_denial(&self, path: &str) -> Option<ProtectedBy> {
        let resolved = self
            .tree
            .project(&self.repo_root.join(path))
            .ok()
            .flatten()
            .and_then(|node| {
                node.identity
                    .strip_prefix(&self.repo_root)
                    .ok()
                    .map(|path| path.to_string_lossy().replace('\\', "/"))
            });
        self.sources.denial(path, resolved.as_deref())
    }

    fn source_reason(&self, path: &str, cause: ProtectedBy) -> PublicDenial {
        match cause {
            ProtectedBy::RootMatch { .. } => PublicDenial::RootMatch,
            ProtectedBy::ReservedBasename => PublicDenial::Reserved,
            ProtectedBy::ListedInput => {
                if let Some(origin) = self.plugin_inputs.get(path) {
                    return PublicDenial::Postcss {
                        plugin: origin.plugin.clone(),
                        stylesheet: origin.stylesheet.clone(),
                        relative_file: mokly_model::routes::relative(&origin.stylesheet, path),
                    };
                }
                let direct = self.imported_by.get(path).cloned();
                let imported = direct.or_else(|| {
                    if self.imported_by.is_empty() {
                        return None;
                    }
                    let node = self
                        .tree
                        .project(&self.repo_root.join(path))
                        .ok()
                        .flatten()?;
                    let path = node
                        .identity
                        .strip_prefix(&self.repo_root)
                        .ok()?
                        .to_string_lossy()
                        .replace('\\', "/");
                    self.imported_by.get(&path).cloned()
                });
                imported.map_or(PublicDenial::Listed, |stylesheet| PublicDenial::Imported {
                    stylesheet,
                })
            }
        }
    }

    fn decide(&self, path: &str, input_root: bool) -> result::Result<PublicFile, PublicDenial> {
        if path.starts_with('/')
            || path.contains(['\\', ':', '\0'])
            || path.split('/').any(|part| matches!(part, "" | "." | ".."))
        {
            return Err(PublicDenial::Unsafe);
        }
        if path.split('/').any(|part| part.starts_with('.')) {
            return Err(PublicDenial::Hidden);
        }
        if path
            .split('/')
            .next()
            .is_some_and(|first| first.eq_ignore_ascii_case("mokly-generated"))
        {
            return Err(PublicDenial::Generated);
        }
        if path.split('/').any(|part| part == "node_modules") {
            return Err(PublicDenial::Dependency);
        }
        let absolute = self.repo_root.join(path);
        if self
            .private
            .iter()
            .any(|private| absolute.starts_with(private))
        {
            return Err(PublicDenial::Private);
        }
        let initial = self.sources.denial(path, None);
        let cause = if matches!(initial, Some(ProtectedBy::RootMatch { .. })) {
            initial
        } else if initial.is_some() {
            self.resolved_denial(path).or(initial)
        } else {
            None
        };
        if let Some(cause) = cause
            && !(input_root && cause == ProtectedBy::ListedInput)
        {
            return Err(self.source_reason(path, cause));
        }
        let mut cursor = self.repo_root.clone();
        let mut final_kind = FileKind::Other;
        for part in path.split('/') {
            cursor.push(part);
            let node = match self.tree.project(&cursor) {
                Ok(Some(node)) => node,
                _ => return Err(PublicDenial::Unavailable),
            };
            if node.lexical_kind == FileKind::Symlink {
                if let Some(cause) = self.resolved_denial(path) {
                    return Err(self.source_reason(path, cause));
                }
                return Err(PublicDenial::Symlink);
            }
            if !node.identity.starts_with(&self.repo_root) {
                return Err(PublicDenial::Escape);
            }
            final_kind = node.kind;
        }
        if final_kind != FileKind::File {
            return Err(PublicDenial::Unavailable);
        }
        Ok(PublicFile {
            path: path.into(),
            absolute,
        })
    }
}

impl PublicPolicy for FilePolicy {
    fn check(&self, path: &str) -> result::Result<PublicFile, PublicDenial> {
        let mut decisions = self
            .decisions
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        decisions
            .entry(path.into())
            .or_insert_with(|| self.decide(path, false))
            .clone()
    }
}
