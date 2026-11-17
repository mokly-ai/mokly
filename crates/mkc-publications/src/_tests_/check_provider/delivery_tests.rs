//! Created, recovered and recorded checks keep one provider identity.

use std::sync::Arc;

use mkc_github_interface::check::{CheckRuns, Conclusion};
use mkc_github_interface::checks::{ChecksMock, Status};
use mkc_store_interface::github_check::GitHubChecksMock;
use unimock::{MockFn, Unimock, matching};

use super::support::{adapter, binding, check, record, repository, run};

#[test]
fn recorded_run_updates_in_the_current_canonical_repository() {
    let queries = Unimock::new((
        binding(),
        GitHubChecksMock::github_check_by_external_id
            .next_call(matching!(_, _))
            .returns(Ok(Some(record()))),
    ));
    let checks = Unimock::new(
        ChecksMock::update
            .next_call(matching!(1, "New-Owner/Renamed", 4, _))
            .answers(&|_, _, _, _, update| {
                assert_eq!(
                    update.details_url.as_deref(),
                    Some(check().details_url.as_str())
                );
                assert_eq!(update.status, Status::Completed);
                assert_eq!(update.output.as_ref().unwrap().summary, check().summary);
                Ok(run())
            }),
    );
    let service: &dyn CheckRuns = &adapter(queries, checks, false);
    service.upsert(&check()).unwrap();
}

#[test]
fn absent_run_is_listed_before_create_and_recorded_after_acknowledgement() {
    let queries = Unimock::new((
        binding(),
        GitHubChecksMock::github_check_by_external_id
            .next_call(matching!(_, _))
            .returns(Ok(None)),
        GitHubChecksMock::record_github_check
            .next_call(matching!(_))
            .answers(&|_, value| {
                assert_eq!(value.project_id, check().project_id);
                assert_eq!(value.repository_id, repository().id);
                assert_eq!(value.github_id, 4);
                assert_eq!(value.external_id, check().external_id);
                assert!(!value.rerequested);
                Ok(())
            }),
    ));
    let checks = Unimock::new((
        ChecksMock::list
            .next_call(matching!(1, "New-Owner/Renamed", _, 123))
            .returns(Ok(vec![])),
        ChecksMock::create
            .next_call(matching!(1, "New-Owner/Renamed", _))
            .answers(&|_, _, _, input| {
                assert_eq!(input.external_id, check().external_id);
                assert_eq!(input.head_sha, check().head_sha);
                assert_eq!(input.details_url, check().details_url);
                assert!(input.update.details_url.is_none());
                Ok(run())
            }),
    ));
    adapter(queries, checks, true).upsert(&check()).unwrap();
}

#[test]
fn ambiguous_create_recovers_only_the_matching_external_id_and_updates_output() {
    let queries = Unimock::new((
        binding(),
        GitHubChecksMock::github_check_by_external_id
            .next_call(matching!(_, _))
            .returns(Ok(None)),
        GitHubChecksMock::record_github_check
            .next_call(matching!(_))
            .returns(Ok(())),
    ));
    let mut unrelated = run();
    unrelated.id = 5;
    unrelated.external_id = Some("mokly-publication:other".into());
    let checks = Unimock::new((
        ChecksMock::list
            .next_call(matching!(1, "New-Owner/Renamed", _, 123))
            .returns(Ok(vec![unrelated, run()])),
        ChecksMock::update
            .next_call(matching!(1, "New-Owner/Renamed", 4, _))
            .returns(Ok(run())),
    ));
    adapter(queries, checks, true).upsert(&check()).unwrap();
}

#[test]
fn all_lifecycle_states_map_to_the_provider_without_inventing_a_conclusion() {
    for (status, conclusion) in [
        (Status::Queued, None),
        (Status::InProgress, None),
        (Status::Completed, Some(Conclusion::Success)),
        (Status::Completed, Some(Conclusion::Neutral)),
        (Status::Completed, Some(Conclusion::Failure)),
        (Status::Completed, Some(Conclusion::Cancelled)),
    ] {
        let mut value = check();
        value.status = status;
        value.conclusion = conclusion;
        let queries = Unimock::new((
            binding(),
            GitHubChecksMock::github_check_by_external_id
                .next_call(matching!(_, _))
                .returns(Ok(Some(record()))),
        ));
        let checks = Unimock::new(
            ChecksMock::update
                .next_call(matching!(_, _, _, _))
                .answers_arc(Arc::new(move |_, _, _, _, update| {
                    assert_eq!(update.status, status);
                    assert_eq!(update.conclusion.is_some(), status == Status::Completed);
                    assert_eq!(
                        update.conclusion.map(|value| format!("{value:?}")),
                        conclusion.map(|value| format!("{value:?}"))
                    );
                    Ok(run())
                })),
        );
        adapter(queries, checks, false).upsert(&value).unwrap();
    }
}
