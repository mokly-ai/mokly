//! Catalogue index v7 entry records, without usage or resource evidence.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::axes::{ColorScheme, Viewport};
use crate::catalogue::UseCaseStep;
use crate::controls::ComponentControl;
use crate::prop_schema::PropSchema;
use crate::public_metadata::{CatalogueEntry, ComparisonSelection};
use crate::wire_props::ComponentWireProps;

/// One document view key, available before rendering.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CatalogueView {
    /// Viewport axis.
    pub viewport: Viewport,
    /// Color scheme axis.
    pub color_scheme: ColorScheme,
    /// View comparison availability.
    pub comparison: ComparisonSelection,
    /// Render graph document input hash.
    pub document_key: String,
}

/// Public validated prop model and document views.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CatalogueVisual {
    /// Effective schemes, light first.
    pub color_schemes: Vec<ColorScheme>,
    /// Validated prop schema.
    pub prop_schema: PropSchema,
    /// Complete tagged props, including negative zero.
    pub props: ComponentWireProps,
    /// Editable controls.
    pub controls: BTreeMap<String, ComponentControl>,
    /// Views in viewport and scheme order.
    pub views: Vec<CatalogueView>,
}

/// Literal screen record discriminant.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
pub enum CatalogueScreenKind {
    /// The screen kind.
    #[serde(rename = "screen")]
    Value,
}

/// Public screen entry.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct CatalogueScreen {
    /// Literal entry kind.
    pub kind: CatalogueScreenKind,
    /// Common entry metadata.
    #[serde(flatten)]
    pub entry: CatalogueEntry,
    /// Props and view model.
    #[serde(flatten)]
    pub visual: CatalogueVisual,
    /// Address-bar label.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub address: Option<String>,
    /// Parent screen path, exactly on a variant.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub variant_of: Option<String>,
    /// Reciprocal use-case membership.
    pub use_case_paths: Vec<String>,
}

/// Literal component record discriminant.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
pub enum CatalogueComponentKind {
    /// The component kind.
    #[serde(rename = "component")]
    Value,
}

/// Public component entry.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct CatalogueComponent {
    /// Literal entry kind.
    pub kind: CatalogueComponentKind,
    /// Common entry metadata.
    #[serde(flatten)]
    pub entry: CatalogueEntry,
    /// Props and view model.
    #[serde(flatten)]
    pub visual: CatalogueVisual,
    /// Parent component path, exactly on a variant.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub variant_of: Option<String>,
    /// Declared slot names.
    pub slots: Vec<String>,
    /// Supplied slot names; empty on a parent.
    pub supplied_slots: Vec<String>,
    /// Component comparison eligibility.
    pub comparison: ComparisonSelection,
}

/// Literal page record discriminant.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
pub enum CataloguePageKind {
    /// The page kind.
    #[serde(rename = "page")]
    Value,
}

/// Public page entry.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct CataloguePage {
    /// Literal entry kind.
    pub kind: CataloguePageKind,
    /// Common entry metadata.
    #[serde(flatten)]
    pub entry: CatalogueEntry,
    /// The one page document input hash.
    pub document_key: String,
}

/// Literal document record discriminant.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
pub enum CatalogueDocumentKind {
    /// The document kind.
    #[serde(rename = "document")]
    Value,
}

/// Public document entry.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct CatalogueDocument {
    /// Literal entry kind.
    pub kind: CatalogueDocumentKind,
    /// Common entry metadata.
    #[serde(flatten)]
    pub entry: CatalogueEntry,
    /// Effective document schemes.
    pub color_schemes: Vec<ColorScheme>,
    /// One input hash per scheme.
    pub document_keys: Vec<DocumentKey>,
}

/// Literal use-case record discriminant.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
pub enum CatalogueUseCaseKind {
    /// The use-case kind.
    #[serde(rename = "use-case")]
    Value,
}

/// Public use-case entry.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct CatalogueUseCase {
    /// Literal entry kind.
    pub kind: CatalogueUseCaseKind,
    /// Common entry metadata.
    #[serde(flatten)]
    pub entry: CatalogueEntry,
    /// Ordered screen steps.
    pub steps: Vec<UseCaseStep>,
}

/// Document input hash for one scheme.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DocumentKey {
    /// Color scheme axis.
    pub color_scheme: ColorScheme,
    /// Render graph document input hash.
    pub document_key: String,
}

/// Every public current or removed entry kind.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(untagged)]
pub enum CatalogueRecord {
    /// Screen, including screen variants.
    Screen(CatalogueScreen),
    /// Registered component, including component variants.
    Component(CatalogueComponent),
    /// Authored HTML page.
    Page(CataloguePage),
    /// Markdown document.
    Document(CatalogueDocument),
    /// Ordered journey.
    UseCase(CatalogueUseCase),
}
