//! Count actual SQL statements as reference-list cardinality grows.

use std::cell::RefCell;
use std::thread_local;

use diesel::connection::{Instrumentation, InstrumentationEvent, set_default_instrumentation};
use mkc_store_interface::github_refs::{Branch, PullRequest};
use mkc_store_interface::publication::PublicationState;

use super::support::{run, time};

thread_local! {
    static STATEMENTS: RefCell<Option<Vec<String>>> = const { RefCell::new(None) };
}

fn instrumentation() -> Option<Box<dyn Instrumentation>> {
    Some(Box::new(|event: InstrumentationEvent<'_>| {
        if let InstrumentationEvent::StartQuery { query, .. } = event {
            STATEMENTS.with_borrow_mut(|statements| {
                if let Some(statements) = statements {
                    statements.push(query.to_string());
                }
            });
        }
    }))
}

fn start_counting() {
    STATEMENTS.with_borrow_mut(|value| *value = Some(Vec::new()));
}

fn assert_one_statement(operation: &str, rows: usize) {
    let statements = STATEMENTS.with_borrow_mut(Option::take).unwrap();
    assert_eq!(statements.len(), 1, "{operation}: {statements:?}");
    println!("PASS {operation}: {rows} references, 1 SQL statement");
}

#[test]
fn reference_lists_use_one_query_for_fifty_rows() {
    set_default_instrumentation(instrumentation).unwrap();
    run(&mut |q, fixture| {
        q.link_github_project(fixture.project, fixture.repository.id)?;
        for number in 1..=50 {
            let branch = format!("branch-{number:02}");
            q.save_github_branch(&Branch {
                repository_id: fixture.repository.id,
                name: branch.clone(),
                head_sha: Some("a".repeat(40)),
                updated_at: time(5),
            })?;
            q.save_github_pull_request(&PullRequest {
                repository_id: fixture.repository.id,
                number,
                title: format!("PR {number}"),
                author: Some("octocat".into()),
                open: true,
                merged: false,
                head_ref: branch.clone(),
                head_sha: "a".repeat(40),
                base_ref: "main".into(),
                base_sha: "b".repeat(40),
                head_repository_id: Some(100),
                base_repository_id: Some(100),
                updated_at: time(5),
            })?;
            let mut publication =
                fixture.publication(number as u128 + 100, &branch, 1, PublicationState::Ready);
            publication.metadata.as_mut().unwrap().pull_request = Some(number);
            q.insert_publication(&publication)?;
        }
        start_counting();
        let branches = q.viewer_branches(fixture.project, None, 101)?;
        assert_one_statement("listBranches", branches.len());
        assert_eq!(branches.len(), 50);
        assert!(branches.iter().all(|row| row.newest_publication.is_some()));
        start_counting();
        let pulls = q.viewer_pull_requests(fixture.project, None, 101)?;
        assert_one_statement("listPullRequests", pulls.len());
        assert_eq!(pulls.len(), 50);
        assert!(pulls.iter().all(|row| row.newest_publication.is_some()));
        Ok(())
    });
}
