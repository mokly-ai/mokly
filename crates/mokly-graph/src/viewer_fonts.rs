//! The one target outside `static/` that the referenced closure accepts: a face
//! that the viewer delivers, named by a Markdown document's own stylesheet.

use std::sync::Arc;

use mokly_css::syntax::Reference;
use mokly_model::catalogue::EntryContent;
use mokly_model::namespace;

use crate::urls::artifact_target;

/// Whether a document's own CSS may load the faces that the viewer delivers.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ViewerFonts {
    /// Every local reference of the document must stay under `static/`.
    Denied,
    /// A relative CSS `url()` of the document itself may name one of the viewer's
    /// two faces. The walk skips such a reference like an external one.
    Permitted,
}

impl ViewerFonts {
    /// Only a Markdown document loads the viewer's faces.
    pub fn of(content: &EntryContent) -> Self {
        match content {
            EntryContent::Document { .. } => Self::Permitted,
            EntryContent::Screen { .. }
            | EntryContent::Component { .. }
            | EntryContent::Page
            | EntryContent::UseCase { .. } => Self::Denied,
        }
    }

    /// The style references of the document at `source` that the walk follows.
    ///
    /// A permitted document drops each reference that names a viewer `face`. The
    /// face then gets no closure membership, no observation, and no copy under
    /// `static/`. Every other reference stays, so any other target outside
    /// `static/` still escapes.
    pub(crate) fn followed(self, source: &str, references: Arc<[Reference]>) -> Arc<[Reference]> {
        let named = |reference: &Reference| face(source, reference).is_some();
        if self == Self::Denied || !references.iter().any(named) {
            return references;
        }
        references
            .iter()
            .filter(|reference| !named(reference))
            .cloned()
            .collect()
    }
}

/// The viewer face that a CSS `url()` of the document at `source` names: its
/// relative path, without a query or a fragment, resolves to exactly that face.
pub fn face(source: &str, reference: &Reference) -> Option<&'static str> {
    if reference.import || reference.image_set_string || reference.value.contains(['?', '#']) {
        return None;
    }
    let target = artifact_target(source, &reference.value).ok()??;
    namespace::FONT_FACES
        .into_iter()
        .find(|face| namespace::viewer(face) == target)
}

#[cfg(test)]
#[path = "_tests_/viewer_fonts_tests.rs"]
mod viewer_fonts_tests;
