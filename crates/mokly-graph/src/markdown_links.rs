//! Markdown links resolve from source paths before the renderer builds HTML.

use std::sync::Arc;

use mokly_catalogue::config::relative;
use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_html::diagnostic_code::Code;
use mokly_html::error::{HtmlError, Result};
use mokly_html::markdown::{Destination, LinkResolver};
use mokly_model::axes::EntryKind;
use mokly_model::catalogue::ModelEntry;
use mokly_model::routes;
use mokly_source_interface::tree::{FileKind, SourceTree};

use crate::policy::PublicPolicy;
use crate::urls::decode_path;

pub(crate) struct Resolver<'a> {
    pub(crate) tree: Arc<dyn SourceTree>,
    pub(crate) config: &'a ResolvedConfig,
    pub(crate) catalogue: &'a PreparedCatalogue,
    pub(crate) entry: &'a ModelEntry,
    pub(crate) route: &'a str,
    pub(crate) policy: &'a dyn PublicPolicy,
}

impl LinkResolver for Resolver<'_> {
    fn resolve_at(&self, destination: &str, offset: usize) -> Result<Destination> {
        match self.resolve(destination) {
            Ok(value) => Ok(value),
            Err(source) => {
                let mut location = self.entry.metadata.source.clone();
                if let Ok(bytes) = self
                    .tree
                    .read_shared(&self.config.repo_root.join(&location.path))
                {
                    let text = String::from_utf8_lossy(&bytes);
                    let body = self
                        .catalogue
                        .documents
                        .get(&self.entry.metadata.path)
                        .map_or("", String::as_str);
                    let index = (text.len().saturating_sub(body.len()) + offset).min(text.len());
                    let prefix = text.get(..index).unwrap_or("");
                    location.line = prefix.bytes().filter(|byte| *byte == b'\n').count() + 1;
                    location.column = prefix
                        .rsplit('\n')
                        .next()
                        .map_or(1, |line| line.chars().count() + 1);
                }
                Err(source.at(location))
            }
        }
    }
    fn resolve(&self, destination: &str) -> Result<Destination> {
        if destination.starts_with("mock:") || destination.starts_with('#') {
            return Ok(Destination::Logical(destination.into()));
        }
        if ["http:", "https:", "mailto:"]
            .iter()
            .any(|prefix| destination.to_ascii_lowercase().starts_with(prefix))
        {
            return Ok(Destination::Url(destination.into()));
        }
        let (reference, fragment) = destination
            .split_once('#')
            .map_or((destination, None), |(path, hash)| (path, Some(hash)));
        let (reference, query) = reference
            .split_once('?')
            .map_or((reference, None), |(path, query)| (path, Some(query)));
        if reference.starts_with('/') || reference.contains(['\\', ':']) {
            return Err(self.error(destination, "is not a portable relative path"));
        }
        let decoded = match decode_path(reference) {
            Ok(decoded) => decoded,
            Err(_) => return Err(self.error(destination, "is not a portable relative path")),
        };
        let source = &self.entry.metadata.source.path;
        let path = routes::resolve(source, &decoded)
            .ok_or_else(|| self.error(destination, "is outside the repository"))?;
        let absolute = self.config.repo_root.join(&path);
        let node = match self.tree.project(&absolute) {
            Ok(Some(node)) => node,
            _ => return Err(self.error(destination, "does not exist")),
        };
        if !node.identity.starts_with(&self.config.repo_root) {
            return Err(self.error(destination, "is outside the repository"));
        }
        if let Some(document) = self.catalogue.model.entries.iter().find(|entry| {
            entry.content.kind() == EntryKind::Document && entry.metadata.source.path == path
        }) {
            if query.is_some() {
                return Err(self.error(destination, "must not contain a query"));
            }
            let fragment = match fragment.filter(|fragment| !fragment.is_empty()) {
                Some(fragment) => {
                    match percent_encoding::percent_decode_str(fragment).decode_utf8() {
                        Ok(fragment) => format!("#{fragment}"),
                        Err(_) => {
                            return Err(self.error(destination, "is not a portable relative path"));
                        }
                    }
                }
                None => String::new(),
            };
            return Ok(Destination::Logical(format!(
                "mock:{}{fragment}",
                document.metadata.path
            )));
        }
        let extension = path.rsplit('.').next().unwrap_or("");
        if ["png", "jpg", "jpeg", "gif", "svg", "webp", "avif", "pdf"].contains(&extension) {
            let root = &self.config.roots[self.entry.metadata.root_index];
            if !absolute.starts_with(&root.directory) || !node.identity.starts_with(&root.identity)
            {
                return Err(self.resource_error(destination, "is outside the root"));
            }
            if node.kind != FileKind::File || node.lexical_kind == FileKind::Symlink {
                return Err(self.resource_error(
                    destination,
                    "must be a regular file without symlink aliases",
                ));
            }
            if path.split('/').any(|part| part.starts_with('.')) {
                return Err(self.resource_error(destination, "contains a hidden path segment"));
            }
            if let Some(private) = path.split('/').find(|part| {
                [
                    "node_modules",
                    "target",
                    "dist",
                    "coverage",
                    "test-results",
                    "playwright-report",
                ]
                .contains(part)
            }) {
                return Err(self.resource_error(
                    destination,
                    &format!("is inside a private build or dependency directory ({private})"),
                ));
            }
            let public_path = relative(&node.identity, &self.config.repo_root);
            if let Err(reason) = self.policy.check(&public_path) {
                return Err(self.resource_error(destination, &reason.reason()));
            }
            let href = routes::relative(
                &format!("static/mokly-generated/{}", self.route),
                &format!("static/{public_path}"),
            );
            return Ok(Destination::Url(
                href + &query.map_or(String::new(), |q| format!("?{q}"))
                    + &fragment.map_or(String::new(), |f| format!("#{f}")),
            ));
        }
        Ok(Destination::Text)
    }
}

impl Resolver<'_> {
    fn error(&self, destination: &str, reason: &str) -> HtmlError {
        HtmlError::Invalid {
            code: Code::BuildInvalid,
            message: format!("link target {destination} {reason}"),
            location: None,
        }
    }
    fn resource_error(&self, destination: &str, reason: &str) -> HtmlError {
        HtmlError::Invalid {
            code: Code::BuildInvalid,
            message: format!("resource {destination} {reason}"),
            location: None,
        }
    }
}
