//! Summary attribution stays with the producer's versioned Changes membership.

use serde_json::json;

use mkc_store_interface::publication_changes::Counts;

use crate::check_summary::{changes, summary};

use super::index_fixture::{empty, parse, record, released};
use super::support::{PUBLICATION, locations, organization_slug, project_slug};

#[test]
fn direct_entries_are_counted_and_links_are_bounded_to_twenty() {
    let mut document = empty();
    for index in 0..25 {
        let entry = record(
            &format!("entry/{index}"),
            &format!("Entry [{index}](target)\n<html>"),
            ["changed", "added", "removed"][index % 3],
        );
        if index % 3 == 2 {
            document["removedEntries"]
                .as_array_mut()
                .unwrap()
                .push(json!({ "entry": entry }));
        } else {
            document["screens"].as_array_mut().unwrap().push(entry);
        }
    }
    let index = parse(&document);
    let (counts, _) = changes(&index);
    assert_eq!(
        counts,
        Counts {
            changed: 9,
            added: 8,
            removed: 8
        }
    );
    let rendered = summary(
        &index,
        &locations(),
        &organization_slug(),
        &project_slug(),
        PUBLICATION,
    )
    .unwrap();
    assert_eq!(
        rendered
            .lines()
            .filter(|line| line.starts_with("- "))
            .count(),
        20
    );
    assert!(rendered.starts_with("9 changed, 8 added, 8 removed."));
    assert!(rendered.contains("Entry \\[0\\]\\(target\\) \\<html\\>"));
    assert!(rendered.contains("catalogueScreen=entry%2F0"));
    let encoded = locations()
        .viewer(
            &organization_slug(),
            &project_slug(),
            PUBLICATION,
            Some("entry&0"),
        )
        .unwrap();
    assert!(encoded.contains("catalogueScreen=entry%260"));
    assert!(!rendered.contains("catalogueScreen=entry%2F20"));
}

#[test]
fn zero_changes_still_link_to_changes() {
    let index = parse(&empty());
    assert_eq!(changes(&index).0, Counts::default());
    let rendered = summary(
        &index,
        &locations(),
        &organization_slug(),
        &project_slug(),
        PUBLICATION,
    )
    .unwrap();
    assert!(rendered.starts_with("0 changed, 0 added, 0 removed."));
    assert!(rendered.contains("[View Changes]"));
}

#[test]
fn the_released_fixture_counts_variant_rows_as_entries() {
    let index = released();
    let (counts, entries) = changes(&index);
    assert_eq!(counts.changed as usize, index.counted_records().len());
    assert_eq!(counts.changed, 7);
    assert_eq!(
        entries.iter().map(|entry| entry.0).collect::<Vec<_>>(),
        [
            "notice",
            "notice/draft",
            "notice/published",
            "guide",
            "page",
            "start",
            "publish"
        ]
    );
    assert!(entries.iter().any(|(path, _)| *path == "notice/draft"));
}

#[test]
fn adversarial_titles_and_ids_fit_the_provider_summary_budget() {
    for (title, id, origin_size, no_links) in [
        ("title".repeat(20_000), "entry".to_owned(), 0, false),
        ("[]()*_<>!".repeat(10_000), "entry".to_owned(), 0, false),
        ("界🙂".repeat(20_000), "entry".to_owned(), 0, false),
        ("Title".to_owned(), "a".repeat(1_000), 2_000, false),
        ("Title".to_owned(), "entry".to_owned(), 30_000, true),
    ] {
        let mut document = empty();
        document["screens"] = json!(
            (0..20)
                .map(|index| record(&format!("{id}{index}"), &title, "added"))
                .collect::<Vec<_>>()
        );
        let index = parse(&document);
        let mut targets = locations();
        if origin_size != 0 {
            targets.app_origin = format!("https://example.com/{}", "a".repeat(origin_size));
        }
        let rendered = summary(
            &index,
            &targets,
            &organization_slug(),
            &project_slug(),
            PUBLICATION,
        )
        .unwrap();
        assert!(rendered.len() <= 60_000, "{} bytes", rendered.len());
        assert!(rendered.chars().count() < 65_535);
        assert!(rendered.starts_with("0 changed, 20 added, 0 removed."));
        assert!(rendered.contains(&format!(
            "[View Changes]({})",
            targets
                .viewer(&organization_slug(), &project_slug(), PUBLICATION, None)
                .unwrap()
        )));
        if title.chars().count() > 160 {
            assert!(rendered.contains('…'));
        }
        if no_links {
            assert_eq!(
                rendered
                    .lines()
                    .filter(|line| line.starts_with("- "))
                    .count(),
                0
            );
        }
    }
}
