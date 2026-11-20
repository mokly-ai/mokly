//! Changes counting from the stored catalogue index without recomputing attribution.

use mkc_domain::ids::PublicationId;
use mkc_domain::slug::{ProjectSlug, WorkspaceSlug};
use mkc_mokly_contract::index::CatalogueIndex;
use mkc_store_interface::publication_changes::Counts;

use crate::error::{Error, Result};
use crate::locations::Locations;

/// Conservative UTF-8 byte cap, below GitHub's 65,535-character ceiling.
const SUMMARY_BYTES: usize = 60_000;
/// Display characters including an ellipsis, before Markdown escaping.
const TITLE_CHARACTERS: usize = 160;

/// Counts and ordered entry identities from the index's included Changes records.
pub fn changes(index: &CatalogueIndex) -> (Counts, Vec<(&str, &str)>) {
    let counts = index
        .changes_count()
        .map_or(Counts::default(), |counts| Counts {
            changed: counts.changed,
            added: counts.added,
            removed: counts.removed,
        });
    let entries = index
        .counted_records()
        .iter()
        .map(|record| (record.path.as_str(), record.title.as_str()))
        .collect();
    (counts, entries)
}

/// Concise totals plus at most twenty correctly escaped immutable entry links.
pub fn summary(
    index: &CatalogueIndex,
    locations: &Locations,
    organization: &WorkspaceSlug,
    project: &ProjectSlug,
    publication: PublicationId,
) -> Result<String> {
    let (counts, entries) = changes(index);
    let moved = index.changes_count().map_or(0, |counts| counts.moved);
    let moves = if moved == 0 {
        String::new()
    } else {
        format!("\n{moved} moved.")
    };
    let mut text = format!(
        "{} changed, {} added, {} removed.{}\n\n[View Changes]({})",
        counts.changed,
        counts.added,
        counts.removed,
        moves,
        locations.viewer(organization, project, publication, None)?
    );
    if text.len() > SUMMARY_BYTES {
        return Err(Error::Unavailable);
    }
    for (path, title) in entries.iter().take(20) {
        let line = format!(
            "\n- [{}]({})",
            markdown(title),
            locations.viewer(organization, project, publication, Some(path))?
        );
        if text.len() + line.len() > SUMMARY_BYTES {
            break;
        }
        text.push_str(&line);
    }
    Ok(text)
}

fn markdown(value: &str) -> String {
    let mut escaped = String::new();
    let mut characters = value.chars();
    let mut title: String = characters.by_ref().take(TITLE_CHARACTERS).collect();
    if characters.next().is_some() {
        title.pop();
        title.push('…');
    }
    for character in title.chars() {
        if "\\`*_{}[]()#+-.!|<>".contains(character) {
            escaped.push('\\');
        }
        escaped.push(if character.is_control() {
            ' '
        } else {
            character
        });
    }
    escaped
}
