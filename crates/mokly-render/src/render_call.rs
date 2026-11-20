//! One pure sidecar call builder preserves all canonical fragment inputs.

use mokly_html::fragment::{FragmentRequest, RenderKind};
use mokly_model::axes::ColorScheme;
use mokly_sidecar::bindings::{EntryBinding, SlotInput};
use mokly_sidecar::methods::{self, Call, IgnoreScope};

use crate::transport_values;

pub(crate) fn call(generation: &str, request: &FragmentRequest) -> Call {
    let params = methods::Render {
        generation: generation.to_owned(),
        handle: request.handle.clone(),
        entry: EntryBinding {
            path: request.entry_path.clone(),
            title: request.entry_title.clone(),
        },
        props: transport_values::plain_props(&request.props),
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
    match request.kind {
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
    }
}
