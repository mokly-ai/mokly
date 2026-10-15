//! Document composition over the prepared catalogue and injected render boundaries.

use std::collections::{BTreeMap, BTreeSet};
use std::mem;
use std::sync::Arc;

use mokly_catalogue::diagnostic::Warning;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_model::axes::{ColorScheme, Viewport};
use mokly_model::catalogue::{EntryContent, ModelEntry};
use mokly_model::data::Props;
use mokly_model::prop_schema::PropSchema;
use mokly_model::usage::{
    CatalogueUsage, ComponentInputOwner, ComponentInstanceRecord, ComponentSlotRecord,
};

use crate::context::Context;
use crate::diagnostic_code::Code;
use crate::error::{Result, invalid};
use crate::fragment::{FragmentRenderer, OwnedStyle, RenderKind};
use crate::tree::{Node, Region, RegionKind};
use crate::{assembly, error, links, props, regions, relative_links, source_locations};

/// One effective document view. Pages ignore the axes.
pub struct ComposeRequest<'a> {
    /// Private prepared catalogue for this generation.
    pub catalogue: &'a PreparedCatalogue,
    /// Current entry or flattened variant.
    pub entry: &'a ModelEntry,
    /// Effective viewport.
    pub viewport: Viewport,
    /// Effective appearance.
    pub color_scheme: ColorScheme,
    /// Ordered stylesheet hrefs, relative to this document.
    pub stylesheets: Vec<String>,
}

/// Complete composed tree and its private render evidence.
#[derive(Clone, Debug)]
pub struct Composed {
    /// Tree with resolved ownership and ignore annotations.
    pub tree: Vec<Node>,
    /// Logical input and physical placement records.
    pub usage: CatalogueUsage,
    /// Warnings never enter the document bytes.
    pub warnings: Vec<Warning>,
    /// Declared public resource seeds.
    pub resources: Vec<String>,
    /// Components in first-render order, including empty renders.
    pub components: Vec<String>,
    /// Logical references retained for final cross-view anchor checks.
    pub links: Vec<links::Reference>,
}

/// Non-pure composition boundary: JavaScript fragments are injected.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ComposerMock))]
pub trait Composer: Send + Sync {
    /// Compose a screen, component, or authored page with no file writes.
    fn compose(&self, request: &ComposeRequest<'_>) -> Result<Composed>;
}

/// Core HTML renderer; no sidecar starts unless its fragment boundary needs one.
pub struct HtmlComposer {
    /// Memoized JavaScript fragment provider.
    pub fragments: Arc<dyn FragmentRenderer>,
}

pub(crate) struct Engine<'a> {
    pub(crate) invocation_sites: BTreeMap<String, String>,
    pub(crate) placed_slots: BTreeSet<String>,
    pub(crate) request: &'a ComposeRequest<'a>,
    pub(crate) fragments: &'a dyn FragmentRenderer,
    pub(crate) instances: BTreeMap<String, ComponentInstanceRecord>,
    pub(crate) slots: BTreeMap<String, ComponentSlotRecord>,
    pub(crate) orders: BTreeMap<String, u64>,
    pub(crate) components: Vec<String>,
    pub(crate) warnings: Vec<Warning>,
    pub(crate) resources: Vec<String>,
    pub(crate) styles: Vec<OwnedStyle>,
    pub(crate) stack: Vec<String>,
    pub(crate) ignore_ids: BTreeSet<String>,
    pub(crate) slot_cache: BTreeMap<(String, bool), Vec<Node>>,
}

impl Composer for HtmlComposer {
    fn compose(&self, request: &ComposeRequest<'_>) -> Result<Composed> {
        let mut engine = Engine {
            invocation_sites: BTreeMap::new(),
            placed_slots: BTreeSet::new(),
            request,
            fragments: self.fragments.as_ref(),
            instances: BTreeMap::new(),
            slots: BTreeMap::new(),
            orders: BTreeMap::new(),
            components: Vec::new(),
            warnings: Vec::new(),
            resources: Vec::new(),
            styles: Vec::new(),
            stack: Vec::new(),
            ignore_ids: BTreeSet::new(),
            slot_cache: BTreeMap::new(),
        };
        let result = (|| -> Result<Composed> {
            let entry = request.entry;
            let (schema, props, declared_slots) = match &entry.content {
                EntryContent::Screen { visual, .. } => {
                    (visual.prop_schema.clone(), visual.props.clone(), Vec::new())
                }
                EntryContent::Component { visual, slots, .. } => (
                    visual.prop_schema.clone(),
                    visual.props.clone(),
                    slots.clone(),
                ),
                EntryContent::Page => (PropSchema::default(), Props::new(), Vec::new()),
                _ => return Err(invalid(Code::HtmlElement, "entry has no HTML render")),
            };
            let parent = entry
                .metadata
                .variant_of
                .as_deref()
                .unwrap_or(&entry.metadata.path);
            let body_metadata = entry
                .metadata
                .variant_of
                .as_ref()
                .and_then(|parent| {
                    request
                        .catalogue
                        .model
                        .entries
                        .iter()
                        .find(|entry| &entry.metadata.path == parent)
                })
                .map_or(&entry.metadata, |entry| &entry.metadata);
            let mut context = Context {
                raw_text: false,
                link_base: relative_links::base(body_metadata),
                replay: false,
                props,
                schema,
                source: entry.metadata.source.clone(),
                owner: ComponentInputOwner::Entry,
                slot_key: None,
                ignore: true,
                slots: BTreeMap::new(),
                declared_slots,
            };
            engine.saved_slots(&mut context)?;
            let mut tree = if let Some(template) = request.catalogue.templates.get(parent) {
                let nodes = source_locations::template(template)?;
                engine.nodes(nodes, &context)?
            } else {
                let kind = if matches!(entry.content, EntryContent::Page) {
                    RenderKind::Page
                } else if matches!(entry.content, EntryContent::Component { .. }) {
                    RenderKind::Component
                } else {
                    RenderKind::Screen
                };
                engine.javascript(parent, kind, &context)?
            };
            if matches!(entry.content, EntryContent::Component { .. }) {
                engine.components.insert(0, parent.into());
                tree = vec![Node::Region {
                    region: Region {
                        id: String::new(),
                        kind: RegionKind::Root {
                            path: parent.into(),
                        },
                    },
                    children: tree,
                }];
            }
            if matches!(entry.content, EntryContent::Page) {
                assembly::append_styles(&mut tree, &engine.styles);
            }
            if !matches!(entry.content, EntryContent::Page) {
                tree = assembly::document(
                    &entry.metadata.title,
                    request.color_scheme,
                    &engine.styles,
                    &request.stylesheets,
                    tree,
                );
            }
            regions::validate(&tree)?;
            let ranges = regions::number(&mut tree);
            tracing::debug!(
                entry = entry.metadata.path,
                instances = engine.instances.len(),
                "HTML composed"
            );
            Ok(Composed {
                tree,
                usage: CatalogueUsage::Ready {
                    instances: mem::take(&mut engine.instances).into_values().collect(),
                    slots: mem::take(&mut engine.slots).into_values().collect(),
                    ranges,
                },
                warnings: mem::take(&mut engine.warnings),
                resources: mem::take(&mut engine.resources),
                components: mem::take(&mut engine.components),
                links: Vec::new(),
            })
        })();
        match result {
            Ok(composed) => Ok(composed),
            Err(source) => Err(error::HtmlError::Attempt {
                source: Box::new(source),
                warnings: engine.warnings,
            }),
        }
    }
}

impl Engine<'_> {
    pub(crate) fn nodes(&mut self, nodes: Vec<Node>, context: &Context) -> Result<Vec<Node>> {
        let mut output = Vec::new();
        for node in nodes {
            match node {
                Node::Text(text) => output.push(Node::Text(if context.raw_text {
                    props::substitute_raw(&text, &context.schema, &context.props)?
                } else {
                    props::substitute(&text, &context.schema, &context.props)?
                })),
                Node::Element(element) => {
                    let location = element
                        .source
                        .clone()
                        .unwrap_or_else(|| context.source.clone());
                    match self.element(element, context) {
                        Ok(nodes) => output.extend(nodes),
                        Err(source) => {
                            return Err(error::HtmlError::Located {
                                location,
                                source: Box::new(source),
                            });
                        }
                    }
                }
                Node::Comment(text) if text.trim_start().starts_with("mokly-") => {}
                node => output.push(node),
            }
        }
        Ok(output)
    }
}
