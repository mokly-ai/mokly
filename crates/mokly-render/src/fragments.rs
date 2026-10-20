//! Render sidecar calls into the authenticated fragment contract.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_html::error::{HtmlError, InternalError};
use mokly_html::fragment::{
    Fragment, FragmentMarker, FragmentMarkerKind, FragmentRenderer, FragmentRequest, OwnedStyle,
    RenderKind,
};
use mokly_model::axes::ColorScheme;
use mokly_model::routes;
use mokly_model::usage::{ComponentInstanceRecord, ComponentSlotRecord};
use mokly_sidecar::bindings::{EntryBinding, SlotInput};
use mokly_sidecar::methods::{self, Call, IgnoreScope};
use mokly_sidecar::pool::SidecarPool;
use mokly_sidecar::render_records::MarkerPayload;
use mokly_sidecar::results::Render;
use mokly_sidecar::wire::MethodResult;

use crate::diagnostics;
use crate::error::{RenderError, Result, convert};

pub(crate) struct Fragments {
    pub(crate) _lease: Option<std::sync::Arc<dyn mokly_catalogue::render_sources::GenerationLease>>,
    pub(crate) pool: Arc<dyn SidecarPool>,
    pub(crate) generation: String,
}

impl FragmentRenderer for Fragments {
    #[tracing::instrument(name = "render.fragment", skip_all, fields(status = "error"))]
    fn render(&self, request: &FragmentRequest) -> mokly_html::error::Result<Fragment> {
        match self.render_fragment(request) {
            Ok(fragment) => {
                tracing::Span::current().record("status", "ok");
                Ok(fragment)
            }
            Err(source) => match source.diagnostic() {
                Some(source) => Err(HtmlError::Runtime { source }),
                None => Err(HtmlError::Internal(InternalError::Provider {
                    source: Box::new(source),
                })),
            },
        }
    }
}

impl Fragments {
    fn render_fragment(&self, request: &FragmentRequest) -> Result<Fragment> {
        let params = methods::Render {
            generation: self.generation.clone(),
            handle: request.handle.clone(),
            entry: EntryBinding {
                path: request.entry_path.clone(),
                title: request.entry_title.clone(),
            },
            props: convert(&request.props)?,
            viewport: match request.viewport {
                mokly_model::axes::Viewport::Mobile => "mobile",
                mokly_model::axes::Viewport::Desktop => "desktop",
            }
            .into(),
            color_scheme: match request.color_scheme {
                ColorScheme::Light => methods::ColorScheme::Light,
                ColorScheme::Dark => methods::ColorScheme::Dark,
            },
        };
        let call = match request.kind {
            RenderKind::Screen => Call::RenderScreen(params),
            RenderKind::Component => Call::RenderComponent(methods::RenderComponent {
                render: params,
                slots: request
                    .slots
                    .iter()
                    .map(|(name, token)| {
                        (
                            name.clone(),
                            SlotInput::Placeholder {
                                token: token.clone(),
                            },
                        )
                    })
                    .chain(request.saved_slots.iter().map(|(name, handle)| {
                        (
                            name.clone(),
                            SlotInput::Saved {
                                handle: handle.clone(),
                            },
                        )
                    }))
                    .collect(),
                ignore_scope: if request.ignore_enabled {
                    IgnoreScope::Enabled
                } else {
                    IgnoreScope::Disabled
                },
            }),
            RenderKind::Story => Call::RenderStory(methods::RenderStory {
                generation: params.generation,
                story_id: params.handle,
                props: params.props,
                viewport: params.viewport,
                color_scheme: params.color_scheme,
            }),
            RenderKind::Page => Call::RenderPage(methods::RenderPage {
                generation: params.generation,
                handle: params.handle,
            }),
        };
        let result = match self.pool.request(call) {
            Ok(result) => result,
            Err(source) => return Err(RenderError::Sidecar { source }),
        };
        let route = if matches!(request.kind, RenderKind::Page) {
            routes::document(&request.entry_path, ColorScheme::Light)
        } else {
            routes::view(&request.entry_path, request.viewport, request.color_scheme)
        };
        match result {
            MethodResult::Render(result) => fragment(result, &route),
            MethodResult::Page(result) if matches!(request.kind, RenderKind::Page) => {
                Ok(Fragment {
                    html: result.html,
                    resources: result.resources,
                    warnings: diagnostics::warnings(&result.warnings, &route),
                    ..Default::default()
                })
            }
            _ => Err(RenderError::ResultKind { method: "render" }),
        }
    }
}

pub(crate) fn fragment(result: Render, route: &str) -> Result<Fragment> {
    let mut instances: BTreeMap<String, ComponentInstanceRecord> = BTreeMap::new();
    for instance in &result.instances {
        let record = ComponentInstanceRecord {
            key: instance.key.clone(),
            id: instance.id.clone(),
            component_id: instance.component_path.clone(),
            owner: convert(&instance.owner)?,
            slot_key: instance.slot_key.clone(),
            order: instance.order,
            props: instance.props.clone(),
            props_key: instance.props_key.clone(),
            source: match &instance.source {
                Some(source) => Some(convert(source)?),
                None => None,
            },
        };
        if let Some(previous) = instances.get(&instance.key)
            && convert::<_, serde_json::Value>(previous)?
                != convert::<_, serde_json::Value>(&record)?
        {
            return Err(RenderError::Input {
                key: instance.key.clone(),
            });
        }
        instances.insert(instance.key.clone(), record);
    }
    let mut slots: BTreeMap<String, ComponentSlotRecord> = BTreeMap::new();
    for slot in &result.slots {
        let record = ComponentSlotRecord {
            key: slot.key.clone(),
            instance_key: slot.instance_key.clone(),
            name: slot.name.clone(),
            owner: convert(&slot.owner)?,
            source_slot_key: slot.source_slot_key.clone(),
        };
        if let Some(previous) = slots.get(&slot.key)
            && convert::<_, serde_json::Value>(previous)?
                != convert::<_, serde_json::Value>(&record)?
        {
            return Err(RenderError::Input {
                key: slot.key.clone(),
            });
        }
        slots.insert(slot.key.clone(), record);
    }
    let mut markers = Vec::new();
    for marker in result.markers {
        let kind = match marker.payload {
            MarkerPayload::Output => FragmentMarkerKind::Output,
            MarkerPayload::Instance { key } => {
                if !result
                    .instances
                    .iter()
                    .any(|instance| instance.region_id == marker.id && instance.key == key)
                {
                    return Err(RenderError::Input { key });
                }
                FragmentMarkerKind::Instance { key }
            }
            MarkerPayload::Slot { key } => {
                if !result
                    .slots
                    .iter()
                    .any(|slot| slot.key == key && slot.region_ids.contains(&marker.id))
                {
                    return Err(RenderError::Input { key });
                }
                FragmentMarkerKind::Slot { key }
            }
            MarkerPayload::Ignore { material_key } => FragmentMarkerKind::Ignore { material_key },
            MarkerPayload::Link { to } => FragmentMarkerKind::Link { to },
        };
        markers.push(FragmentMarker {
            id: marker.id,
            parent_id: marker.parent_id,
            kind,
        });
    }
    Ok(Fragment {
        html: result.html,
        markers,
        instances: instances.into_values().collect(),
        slots: slots.into_values().collect(),
        styles: result
            .styles
            .into_iter()
            .map(|style| OwnedStyle {
                css: style.css,
                owners: style.owners,
            })
            .collect(),
        resources: result.resources,
        warnings: diagnostics::warnings(&result.warnings, route),
    })
}
