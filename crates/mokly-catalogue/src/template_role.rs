//! Typed roles for entry bodies and saved slot fragments.

use mokly_model::catalogue::SourceLocation;

use crate::diagnostic::WarningSubject;
use crate::template_types::Template;

/// The validation rules that depend on where an HTML fragment is authored.
#[derive(Clone, Copy)]
pub(crate) enum TemplateRole<'a> {
    /// A screen, component, or page body.
    EntryBody {
        /// The entry named by warnings and component edges.
        path: &'a str,
        /// Declared component slots, when this is a component body.
        slots: Option<&'a [String]>,
    },
    /// A saved slot fragment on a component variant.
    SavedSlot {
        /// The parent component named by warnings.
        parent: &'a str,
        /// The component's declared slots.
        slots: &'a [String],
        /// Front matter position of this slot field.
        source: &'a SourceLocation,
    },
}

impl<'a> TemplateRole<'a> {
    /// Return the slots visible to this fragment.
    pub(crate) fn slots(self) -> Option<&'a [String]> {
        match self {
            Self::EntryBody { slots, .. } => slots,
            Self::SavedSlot { slots, .. } => Some(slots),
        }
    }

    /// Return the warning subject for this fragment.
    pub(crate) fn warning_subject(self) -> WarningSubject {
        let path = match self {
            Self::EntryBody { path, .. } => path,
            Self::SavedSlot { parent, .. } => parent,
        };
        if self.slots().is_some() {
            WarningSubject::Component(path.into())
        } else {
            WarningSubject::Entry(path.into())
        }
    }

    /// Whether this role reports unused props and contributes cycle edges.
    pub(crate) fn entry_body(self) -> bool {
        matches!(self, Self::EntryBody { .. })
    }

    /// Whether this role applies element rejection checks.
    pub(crate) fn check_elements(self) -> bool {
        matches!(self, Self::EntryBody { .. })
    }

    /// Resolve an issue location for this fragment.
    pub(crate) fn location(self, template: &Template, offset: usize) -> SourceLocation {
        match self {
            Self::EntryBody { .. } => crate::locations::at(
                &template.source_path,
                &template.source,
                template.body_offset + offset,
            ),
            Self::SavedSlot { source, .. } => source.clone(),
        }
    }

    /// Locate an HTML substitution without changing other diagnostic coordinates.
    pub(crate) fn substitution_location(
        self,
        template: &Template,
        offset: usize,
    ) -> SourceLocation {
        match self {
            Self::EntryBody { .. } => crate::locations::html_at(
                &template.source_path,
                &template.source,
                template.body_offset + offset,
            ),
            Self::SavedSlot { source, .. } => source.clone(),
        }
    }
}
