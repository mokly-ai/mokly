//! Retained metadata charge shared by compact cache entries and comparison captures.

use std::mem;

use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_html::composition::Composed;
use mokly_html::links::Reference;

use crate::document_usage;

/// Charge Rust metadata that stays outside the compressed tree payload.
pub(crate) fn metadata(document: &Composed) -> usize {
    document_usage::usage(&document.usage)
        + warnings(&document.warnings)
        + strings(&document.resources)
        + strings(&document.components)
        + document.links.capacity() * mem::size_of::<Reference>()
        + document
            .links
            .iter()
            .map(|link| {
                link.source_route.capacity()
                    + link.target.capacity()
                    + link.fragment.as_ref().map_or(0, String::capacity)
            })
            .sum::<usize>()
}

fn strings(strings: &Vec<String>) -> usize {
    strings.capacity() * mem::size_of::<String>()
        + strings.iter().map(String::capacity).sum::<usize>()
}

fn warnings(warnings: &Vec<Warning>) -> usize {
    warnings.capacity() * mem::size_of::<Warning>()
        + warnings
            .iter()
            .map(|warning| {
                warning.message.capacity()
                    + match &warning.subject {
                        WarningSubject::Route(path)
                        | WarningSubject::Entry(path)
                        | WarningSubject::Component(path)
                        | WarningSubject::Folder(path)
                        | WarningSubject::Configuration(path) => path.capacity(),
                    }
            })
            .sum::<usize>()
}
