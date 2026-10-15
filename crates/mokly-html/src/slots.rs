//! Lazy slot filling keeps supplier props, input scope, and receiving ignore state.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_catalogue::template_types::RegisteredElement;
use mokly_model::material::slot_key;
use mokly_model::usage::ComponentSlotRecord;

use crate::composition::Engine;
use crate::context::{Context, Slot};
use crate::diagnostic_code::Code;
use crate::error::{HtmlError, Result, invalid};
use crate::tree::{Element, Node, Region, RegionKind};
use crate::{forwarded_slots, ignore_checks, source_locations};

impl Engine<'_> {
    pub(crate) fn supplied_slots(
        &mut self,
        nodes: Vec<Node>,
        component: &RegisteredElement,
        context: &Context,
        instance: &str,
    ) -> Result<BTreeMap<String, Slot>> {
        let mut supplied: BTreeMap<String, Vec<Node>> = BTreeMap::new();
        for mut node in nodes {
            let name = if let Node::Element(element) = &mut node {
                element.take("slot").unwrap_or_else(|| "children".into())
            } else {
                "children".into()
            };
            if matches!(&node, Node::Text(text) if text.trim().is_empty())
                && !component.slots.contains(&name)
            {
                continue;
            }
            if !component.slots.contains(&name) {
                return Err(invalid(
                    Code::HtmlSlot,
                    format!("component {} does not declare slot {name}", component.path),
                ));
            }
            supplied.entry(name).or_default().push(node);
        }
        let mut slots = BTreeMap::new();
        let caller = Arc::new(context.clone());
        for (name, nodes) in supplied {
            let key = match slot_key(instance, &name) {
                Ok(key) => key,
                Err(source) => return Err(HtmlError::Props { source }),
            };
            let (supplier, nodes, source_slot_key, origin_key) =
                match forwarded_slots::forwarded(&nodes, context) {
                    Some(original) => (
                        original.supplier,
                        original.nodes,
                        original.key,
                        original.origin_key,
                    ),
                    None => (
                        caller.clone(),
                        Arc::new(nodes),
                        context.slot_key.clone(),
                        context.slot_key.clone(),
                    ),
                };
            self.slots.insert(
                key.clone(),
                ComponentSlotRecord {
                    key: key.clone(),
                    instance_key: instance.into(),
                    name: name.clone(),
                    owner: supplier.owner.clone(),
                    source_slot_key,
                },
            );
            slots.insert(
                name,
                Slot {
                    nodes,
                    supplier,
                    origin_key: origin_key.or_else(|| Some(key.clone())),
                    key: Some(key),
                    instance_key: Some(instance.into()),
                },
            );
        }
        Ok(slots)
    }

    pub(crate) fn saved_slots(&self, context: &mut Context) -> Result<()> {
        let supplier = Arc::new(context.clone());
        if let Some(supplied) = self
            .request
            .catalogue
            .slot_fragments
            .get(&self.request.entry.metadata.path)
        {
            for (name, body) in supplied {
                if !context.declared_slots.contains(name) {
                    return Err(invalid(Code::HtmlSlot, format!("undeclared slot {name}")));
                }
                context.slots.insert(
                    name.clone(),
                    Slot {
                        nodes: Arc::new(source_locations::slot(
                            body,
                            &self.request.entry.metadata.path,
                            name,
                        )),
                        supplier: supplier.clone(),
                        origin_key: None,
                        key: None,
                        instance_key: None,
                    },
                );
            }
        }
        Ok(())
    }

    pub(crate) fn slot(&mut self, element: Element, context: &Context) -> Result<Vec<Node>> {
        let name = element.get("name").unwrap_or("children");
        if !context.declared_slots.iter().any(|slot| slot == name) {
            return Err(invalid(
                Code::HtmlSlot,
                format!("undeclared slot placeholder {name}"),
            ));
        }
        let Some(slot) = context.slots.get(name) else {
            return self.nodes(element.children, context);
        };
        let mut supplier = slot.supplier.as_ref().clone();
        supplier.slot_key = slot.origin_key.clone();
        supplier.ignore = context.ignore;
        let identity = slot
            .key
            .clone()
            .unwrap_or_else(|| format!("root-slot:{name}"));
        let origin = supplier
            .slot_key
            .clone()
            .unwrap_or_else(|| identity.clone());
        supplier.replay = context.replay || !self.placed_slots.insert(origin);
        let cache_key = Some((identity, context.ignore));
        let children =
            if let Some(cached) = cache_key.as_ref().and_then(|key| self.slot_cache.get(key)) {
                cached.clone()
            } else {
                let nodes = self.nodes(slot.nodes.as_ref().clone(), &supplier)?;
                if let Some(key) = cache_key {
                    self.slot_cache.insert(key, nodes.clone());
                }
                nodes
            };
        if let (Some(key), Some(instance_key)) = (&slot.key, &slot.instance_key) {
            Ok(vec![Node::Region {
                region: Region {
                    id: String::new(),
                    kind: RegionKind::Slot {
                        key: key.clone(),
                        instance_key: instance_key.clone(),
                        name: name.into(),
                        owner: supplier.owner,
                    },
                },
                children,
            }])
        } else {
            Ok(children)
        }
    }

    pub(crate) fn ignore(&mut self, element: Element, context: &Context) -> Result<Vec<Node>> {
        let Some(id) = element.get("id").filter(|id| !id.is_empty()) else {
            return Err(invalid(
                Code::HtmlElement,
                "mokly-ignore needs a nonempty id",
            ));
        };
        let material_key = element.get("material-key").map(str::to_owned);
        ignore_checks::id(id)?;
        let id = id.to_owned();
        if context.ignore && !self.ignore_ids.insert(id.clone()) {
            return Err(invalid(
                Code::HtmlElement,
                format!("duplicate ignore id {id}"),
            ));
        }
        let children = self.nodes(element.children, context)?;
        if !context.ignore {
            return Ok(children);
        }
        if contains_ownership(&children) {
            return Err(invalid(
                Code::HtmlElement,
                format!("ignore region {id} cannot enclose an instance or slot region"),
            ));
        }
        Ok(vec![Node::Region {
            region: Region {
                id: String::new(),
                kind: RegionKind::Ignore { id, material_key },
            },
            children,
        }])
    }
}

fn contains_ownership(nodes: &[Node]) -> bool {
    nodes.iter().any(|node| match node {
        Node::Region { region, children } => {
            matches!(
                region.kind,
                RegionKind::Instance { .. } | RegionKind::Slot { .. }
            ) || contains_ownership(children)
        }
        Node::Element(element) => contains_ownership(&element.children),
        _ => false,
    })
}
