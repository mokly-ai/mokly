//! JavaScript fragment seam; only the adapter talks to the sidecar.

use std::collections::BTreeMap;

use mokly_catalogue::diagnostic::Warning;
use mokly_model::axes::{ColorScheme, Viewport};
use mokly_model::data::Props;
use mokly_model::usage::{ComponentInstanceRecord, ComponentSlotRecord};

use crate::error::{HtmlError, Result};

/// A definition's render method, before document composition.
#[derive(Clone, Debug)]
pub enum RenderKind {
    /// Screen fragment.
    Screen,
    /// Registered component fragment.
    Component,
    /// Story fragment.
    Story,
    /// Complete page document.
    Page,
}

/// Fully resolved inputs of one memoizable JavaScript render.
#[derive(Clone, Debug)]
pub struct FragmentRequest {
    /// Definition source and export name, or story id.
    pub handle: String,
    /// Effective catalogue path, including the rendered variant.
    pub entry_path: String,
    /// Effective display title supplied to the consumer renderer.
    pub entry_title: String,
    /// Render method.
    pub kind: RenderKind,
    /// Validated data props.
    pub props: Props,
    /// Viewport; pages do not use it.
    pub viewport: Viewport,
    /// Effective appearance.
    pub color_scheme: ColorScheme,
    /// Enclosing state, applied by the sidecar, never by the core afterwards.
    pub ignore_enabled: bool,
    /// Declared supplied slots and opaque placeholder tokens.
    pub slots: BTreeMap<String, String>,
    /// Generation-owned React slot values saved during describe.
    pub saved_slots: BTreeMap<String, String>,
}

/// Render output with authenticated ownership metadata.
#[derive(Clone, Debug, Default)]
pub struct Fragment {
    /// Authenticated placements emitted by the provider's Mokly API wrappers.
    pub markers: Vec<FragmentMarker>,
    /// Fragment with protocol markers, or a complete page.
    pub html: String,
    /// Collected CSS and its registered owners.
    pub styles: Vec<OwnedStyle>,
    /// Repository-relative public resource seeds.
    pub resources: Vec<String>,
    /// Diagnostics kept outside document bytes.
    pub warnings: Vec<Warning>,
    /// Adapter-validated logical instances referenced by the markers.
    pub instances: Vec<ComponentInstanceRecord>,
    /// Adapter-validated supplied slots referenced by the markers.
    pub slots: Vec<ComponentSlotRecord>,
}

/// One generated marker and its physical enclosing marker before HTML grafting.
#[derive(Clone, Debug)]
pub struct FragmentMarker {
    /// Fragment-local id; a consumer comment cannot create this record.
    pub id: String,
    /// Nearest enclosing generated marker, including ignore and link markers.
    pub parent_id: Option<String>,
    /// Validated API operation and payload.
    pub kind: FragmentMarkerKind,
}

/// Marker payloads are kept separate from consumer-authored HTML strings.
#[derive(Clone, Debug)]
pub enum FragmentMarkerKind {
    /// Adapter output, promoted to a root region only on its own component view.
    Output,
    /// Placement of a recorded logical instance.
    Instance {
        /// Instance input key.
        key: String,
    },
    /// Placement of a recorded supplied slot.
    Slot {
        /// Receiving-slot key, including a forwarding relationship.
        key: String,
    },
    /// Active material-ignore region, with its optional pairing key.
    Ignore {
        /// Material key supplied by the authoring API.
        material_key: Option<String>,
    },
    /// Link-control boundary, consumed before document serialization.
    Link {
        /// Complete or relative destination, with an optional bare fragment.
        to: String,
    },
}

/// One style list and the components that produced it.
#[derive(Clone, Debug)]
pub struct OwnedStyle {
    /// Registered component parent paths, empty for an entry-owned style.
    pub owners: Vec<String>,
    /// Rendered CSS.
    pub css: String,
    /// Comparison records; absent preserves the sheet-level owner contract.
    pub attribution: Option<Vec<StyleAttribution>>,
}

/// Trusted comparison metadata, independent of the delivered style bytes.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct StyleAttribution {
    /// Rendered CSS of the adapter rule identity.
    pub css: String,
    /// Registered component paths; empty for selector attribution.
    pub owners: Vec<String>,
}

/// Object-safe JavaScript render boundary, with a cacheable request.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = FragmentRendererMock))]
pub trait FragmentRenderer: Send + Sync {
    /// Render the named definition without assembling a document.
    fn render(&self, request: &FragmentRequest) -> Result<Fragment>;
}

/// Until a sidecar is injected, HTML-only catalogues need no process.
pub struct DeferredFragments;

impl FragmentRenderer for DeferredFragments {
    fn render(&self, request: &FragmentRequest) -> Result<Fragment> {
        Err(HtmlError::FragmentUnavailable {
            handle: request.handle.clone(),
        })
    }
}
