//! Pure moves count once and retain their totals within the summary byte budget.

use mkc_store_interface::publication_changes::Counts;
use serde_json::json;

use crate::check_summary::{changes, summary};
use crate::error::Error;

use super::index_fixture::{empty, parse, record};
use super::support::{PUBLICATION, locations, organization_slug, project_slug};

#[test]
fn zero_moves_keep_the_exact_initial_summary() {
    let index = parse(&empty());
    let url = locations()
        .viewer(&organization_slug(), &project_slug(), PUBLICATION, None)
        .unwrap();
    assert_eq!(
        summary(
            &index,
            &locations(),
            &organization_slug(),
            &project_slug(),
            PUBLICATION
        )
        .unwrap(),
        format!("0 changed, 0 added, 0 removed.\n\n[View Changes]({url})")
    );
}

#[test]
fn a_pure_move_counts_as_changed_and_links_to_the_current_path() {
    let mut document = empty();
    let mut entry = record("After/Screen_1", "Screen", "unmodified");
    entry["previousPath"] = json!("Before/Screen_1");
    document["screens"] = json!([entry]);
    let index = parse(&document);
    assert_eq!(
        changes(&index).0,
        Counts {
            changed: 1,
            added: 0,
            removed: 0
        }
    );
    let mut targets = locations();
    let url = targets
        .viewer(&organization_slug(), &project_slug(), PUBLICATION, None)
        .unwrap();
    let link = targets
        .viewer(
            &organization_slug(),
            &project_slug(),
            PUBLICATION,
            Some("After/Screen_1"),
        )
        .unwrap();
    assert_eq!(
        summary(
            &index,
            &targets,
            &organization_slug(),
            &project_slug(),
            PUBLICATION
        )
        .unwrap(),
        format!(
            "1 changed, 0 added, 0 removed.\n1 moved.\n\n[View Changes]({url})\n- [Screen]({link})"
        )
    );
    assert!(link.contains("catalogueScreen=After%2FScreen_1"));
    targets.app_origin = format!("https://example.com/{}", "a".repeat(30_000));
    let text = summary(
        &index,
        &targets,
        &organization_slug(),
        &project_slug(),
        PUBLICATION,
    )
    .unwrap();
    assert!(text.len() <= 60_000);
    assert!(text.starts_with("1 changed, 0 added, 0 removed.\n1 moved.\n\n[View Changes]("));
    assert!(!text.contains("\n- "));
    targets.app_origin = format!("https://example.com/{}", "a".repeat(60_000));
    assert!(matches!(
        summary(
            &index,
            &targets,
            &organization_slug(),
            &project_slug(),
            PUBLICATION
        ),
        Err(Error::Unavailable)
    ));
}
