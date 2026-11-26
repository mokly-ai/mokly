//! The branch list reaches a short final page through real cursors.

use std::collections::BTreeSet;

use chrono::{DateTime, Duration, Utc};

use super::super::harness::Harness;
use super::support::{publication, read};

/// Five branches read two at a time come back as two full pages and one short
/// final page that ends the list, with every branch exactly once.
#[test]
fn branch_pages_end_on_a_short_final_page_with_every_branch_once() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    let at = DateTime::from_timestamp(Utc::now().timestamp(), 0).unwrap();
    let names = ["page-a", "page-b", "page-c", "page-d", "page-e"];
    app.queries(&mut |queries| {
        for (index, name) in (0..).zip(names) {
            queries.insert_publication(&publication(
                project.id,
                name,
                index + 1,
                at - Duration::seconds(i64::from(index)),
            ))?;
        }
        Ok(())
    });

    let mut sizes = Vec::new();
    let mut seen = Vec::new();
    let mut tail = "branches?limit=2".to_owned();
    loop {
        let page = read(&app, project.id, &tail);
        let items = page["items"].as_array().unwrap();
        sizes.push(items.len());
        seen.extend(
            items
                .iter()
                .map(|item| item["name"].as_str().unwrap().to_owned()),
        );
        let Some(cursor) = page["nextCursor"].as_str() else {
            assert!(page["nextCursor"].is_null(), "{page}");
            break;
        };
        assert!(sizes.len() < 4, "the list must end after three pages");
        tail = format!("branches?limit=2&cursor={cursor}");
    }
    assert_eq!(sizes, [2, 2, 1]);
    assert_eq!(seen.len(), 5, "{seen:?}");
    assert_eq!(
        seen.iter().map(String::as_str).collect::<BTreeSet<_>>(),
        names.into_iter().collect::<BTreeSet<_>>()
    );
}
