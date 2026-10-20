//! Registered component invocation, props, and logical input identity.

use std::sync::Arc;

use mokly_catalogue::numeric_warnings;
use mokly_catalogue::template_types::RegisteredElement;
use mokly_model::data::Props;
use mokly_model::material::{instance_key, props_key};
use mokly_model::paths::is_path_segment;
use mokly_model::usage::{ComponentInputOwner, ComponentInstanceRecord, ComponentSourceLocation};
use mokly_model::wire_props;

use crate::composition::Engine;
use crate::context::Context;
use crate::diagnostic_code::Code;
use crate::error::{HtmlError, Result, invalid};
use crate::expansion::{After, Expansion};
use crate::fragment::RenderKind;
use crate::props::{camel_case, coerce, schema_at, validate, value_at};
use crate::tree::{Element, Region, RegionKind};
use crate::{conditions, relative_links, source_locations};

impl Engine<'_> {
    #[tracing::instrument(name = "render.fragment", skip_all, err)]
    pub(crate) fn component(
        &mut self,
        mut element: Element,
        component: &RegisteredElement,
        context: &Context,
    ) -> Result<Expansion> {
        if self.stack.contains(&component.path) {
            return Err(invalid(
                Code::HtmlElement,
                format!(
                    "component cycle: {} -> {}",
                    self.stack.join(" -> "),
                    component.source_path
                ),
            ));
        }
        let invocation = element.source.clone();
        let site = element.origin.clone();
        let target = match conditions::reserved(element.take("to"), context)? {
            Some(target) => Some(relative_links::destination(&target, &context.link_base)?),
            None => None,
        };
        let fragment = conditions::reserved(element.take("fragment"), context)?;
        element.take("slot");
        let explicit_id = conditions::reserved(element.take("mokly-instance"), context)?;
        let id = explicit_id
            .as_deref()
            .unwrap_or_else(|| component.path.rsplit('/').next().unwrap_or(&component.path));
        if (explicit_id.is_some() && !kebab(id)) || !is_path_segment(id) {
            return Err(invalid(
                Code::HtmlAttribute,
                format!("invalid component instance id {id:?}"),
            ));
        }
        let mut props = Props::new();
        for attribute in &element.attributes {
            let name = camel_case(&attribute.name);
            let Some(schema) = component
                .prop_schema
                .properties
                .as_ref()
                .and_then(|properties| properties.get(&name))
            else {
                return Err(invalid(
                    Code::HtmlAttribute,
                    format!("component {} has no prop /{name}", component.path),
                ));
            };
            let value = if let Some(reference) = attribute
                .value
                .strip_prefix('$')
                .filter(|_| !attribute.value.starts_with("$$"))
            {
                if schema_at(&context.schema, reference).is_none() {
                    return Err(invalid(
                        Code::HtmlProps,
                        format!("undeclared prop reference {reference}"),
                    ));
                }
                value_at(&context.props, reference).cloned()
            } else {
                let Some(text) = conditions::attribute_value(&attribute.value, context)? else {
                    continue;
                };
                let text = text
                    .strip_prefix("$$")
                    .map_or_else(|| text.clone(), |rest| format!("${rest}"));
                Some(coerce(schema, &text).ok_or_else(|| {
                    invalid(
                        Code::HtmlAttribute,
                        format!("component {} prop /{name} rejects {text:?}", component.path),
                    )
                })?)
            };
            if let Some(value) = value {
                props.insert(name, value);
            }
        }
        self.warnings
            .extend(numeric_warnings::for_entry(&props, self.request.entry));
        validate(&component.prop_schema, &props, &component.path)?;
        let key = match instance_key(&context.owner, context.slot_key.as_deref(), id) {
            Ok(key) => key,
            Err(source) => return Err(HtmlError::Props { source }),
        };
        let props_digest = match props_key(&props) {
            Ok(key) => key,
            Err(source) => return Err(HtmlError::Props { source }),
        };
        let existing = self.instances.get(&key);
        let repeated = context.replay
            && existing.is_some_and(|record| {
                record.props_key == props_digest && record.component_id == component.path
            })
            && site
                .as_ref()
                .is_some_and(|site| self.invocation_sites.get(&key) == Some(site));
        if existing.is_some() && !repeated {
            return Err(invalid(
                Code::HtmlAttribute,
                format!("duplicate component instance id {id:?} in one input scope"),
            ));
        }
        if !repeated {
            let scope = format!("{:?}/{:?}", context.owner, context.slot_key);
            let order = self.orders.entry(scope).or_default();
            self.instances.insert(
                key.clone(),
                ComponentInstanceRecord {
                    key: key.clone(),
                    id: id.into(),
                    component_id: component.path.clone(),
                    owner: context.owner.clone(),
                    slot_key: context.slot_key.clone(),
                    order: *order,
                    props: wire_props::encode(&props),
                    props_key: props_digest.clone(),
                    source: invocation.as_ref().map(|source| ComponentSourceLocation {
                        path: source.path.clone(),
                        line: source.line as u64,
                        column: source.column as u64,
                    }),
                },
            );
            *order += 1;
            if let Some(site) = site {
                self.invocation_sites.insert(key.clone(), site);
            }
        }
        if !self.components.contains(&component.path) {
            self.components.push(component.path.clone());
        }
        let slots = self.supplied_slots(element.children, component, context, &key)?;
        let mut nested = Context {
            raw_text: false,
            link_base: component.link_base.clone(),
            replay: context.replay,
            props,
            schema: component.prop_schema.clone(),
            source: context.source.clone(),
            owner: ComponentInputOwner::Instance {
                instance_key: key.clone(),
            },
            slot_key: None,
            ignore: context.ignore,
            slots,
            declared_slots: component.slots.clone(),
        };
        self.stack.push(component.path.clone());
        let mut expansion =
            if let Some(template) = self.request.catalogue.templates.get(&component.path) {
                nested.source.path = template.source_path.clone();
                Expansion::native(source_locations::template(template)?, Arc::new(nested))
            } else {
                self.javascript_expansion(&component.path, RenderKind::Component, Arc::new(nested))?
            };
        expansion.after.push(After::Component {
            region: Region {
                id: String::new(),
                kind: RegionKind::Instance {
                    path: component.path.clone(),
                    key,
                    local_id: id.into(),
                    props_key: props_digest,
                },
            },
            target,
            fragment,
            source: invocation,
        });
        expansion.span = Some(tracing::Span::current());
        Ok(expansion)
    }
}

fn kebab(value: &str) -> bool {
    !value.is_empty()
        && value.split('-').all(|part| {
            !part.is_empty()
                && part
                    .bytes()
                    .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
        })
}
