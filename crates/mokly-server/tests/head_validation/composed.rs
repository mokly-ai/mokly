//! A renderer-only ignored target that no authored template or recipe scan sees.

use std::sync::Arc;

use mokly_catalogue::working_tree::WorkingTree;
use mokly_graph::types::RenderGeneration;
use mokly_html::composition::{ComposeRequest, Composed, Composer, HtmlComposer};
use mokly_html::error::Result;
use mokly_html::fragment::DeferredFragments;
use mokly_html::tree;
use mokly_html::tree::{Node, Region, RegionKind};
use mokly_source_interface::tree::SourceTree;

use super::support::Fixture;

pub(super) const HOME: &str = "---\ntitle: Home\n---\n<h1>Home</h1>";

struct IgnoredResource;

impl Composer for IgnoredResource {
    fn compose(&self, request: &ComposeRequest<'_>) -> Result<Composed> {
        let mut document = HtmlComposer {
            fragments: Arc::new(DeferredFragments),
        }
        .compose(request)?;
        if request.entry.metadata.path == "home" {
            document.tree.push(Node::Region {
                region: Region {
                    id: "ignored".into(),
                    kind: RegionKind::Ignore {
                        id: "clock".into(),
                        material_key: None,
                    },
                },
                children: vec![tree::element("img", &[("src", "../../icon.svg")], vec![])],
            });
        }
        Ok(document)
    }
}

pub(super) fn generation(
    fixture: &Fixture,
    tree: Option<Arc<dyn SourceTree>>,
) -> Arc<dyn RenderGeneration> {
    fixture.with_composer(
        tree.unwrap_or_else(|| Arc::new(WorkingTree)),
        Arc::new(IgnoredResource),
    )
}
