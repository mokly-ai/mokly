//! Slug suggestions preserve valid candidates at their address limits.

use mkc_domain::slug::{PROJECT_SLUG_MAX_LENGTH, WORKSPACE_SLUG_MAX_LENGTH};
use mkc_domain::values::Role;
use mkc_store_interface::member::MembersMock;
use mkc_store_interface::organization::OrganizationsMock;
use mkc_store_interface::project::ProjectsMock;
use mkc_store_interface::user::UsersMock;
use unimock::{MockFn, Unimock, matching};

use crate::action::Action;
use crate::input::{SuggestProjectSlug, SuggestWorkspaceSlug};
use crate::payload::Payload;
use crate::platform::error::Error;
use crate::platform::execution::Command;

use super::support::{WORKSPACE, execution, member, user};

#[test]
fn workspace_suggestion_does_not_suffix_a_free_truncated_candidate() {
    let expected = "a".repeat(WORKSPACE_SLUG_MAX_LENGTH - 1);
    let action = Action::SuggestWorkspaceSlug(SuggestWorkspaceSlug {
        name: format!("{expected} b"),
    });
    let mut queries = Unimock::new((
        UsersMock::user
            .next_call(matching!(_))
            .returns(Ok(Some(user()))),
        OrganizationsMock::organization_slug_claimed
            .next_call(matching!(_))
            .returns(Ok(false)),
    ));

    let Payload::WorkspaceSlugSuggestion(suggestion) =
        execution(&action).execute(&mut queries).unwrap().payload
    else {
        panic!("workspace slug suggestion response");
    };
    assert_eq!(suggestion.slug.as_str(), expected);
}

#[test]
fn project_suggestion_can_fill_its_limit_with_an_interior_separator() {
    let stem = "p".repeat(PROJECT_SLUG_MAX_LENGTH - 2);
    let expected = format!("{stem}-q");
    let action = Action::SuggestProjectSlug(
        WORKSPACE,
        SuggestProjectSlug {
            repository: format!("owner/{stem}.q"),
            config_path: "mokly.config.json".into(),
        },
    );
    let mut queries = Unimock::new((
        MembersMock::members
            .next_call(matching!(_))
            .returns(Ok(vec![member(Role::Member)])),
        ProjectsMock::project_slug_claimed
            .next_call(matching!(_))
            .returns(Ok(false)),
    ));

    let Payload::ProjectSlugSuggestion(suggestion) =
        execution(&action).execute(&mut queries).unwrap().payload
    else {
        panic!("project slug suggestion response");
    };
    assert_eq!(suggestion.slug.as_str(), expected);
    assert_eq!(suggestion.slug.as_str().len(), PROJECT_SLUG_MAX_LENGTH);
}

#[test]
fn project_suggestion_uses_the_json_config_stem_and_refuses_typescript() {
    let action = Action::SuggestProjectSlug(
        WORKSPACE,
        SuggestProjectSlug {
            repository: "owner/catalogue".into(),
            config_path: "docs/design.json".into(),
        },
    );
    let mut queries = Unimock::new((
        MembersMock::members
            .next_call(matching!(_))
            .returns(Ok(vec![member(Role::Member)])),
        ProjectsMock::project_slug_claimed
            .next_call(matching!((_, slug) if slug.as_str() == "catalogue"))
            .returns(Ok(true)),
        ProjectsMock::project_slug_claimed
            .next_call(matching!((_, slug) if slug.as_str() == "catalogue-design"))
            .returns(Ok(false)),
    ));
    let result = execution(&action).execute(&mut queries);
    assert!(result.is_ok(), "JSON config suggestion: {result:?}");
    let Payload::ProjectSlugSuggestion(suggestion) = result.unwrap().payload else {
        panic!("project slug suggestion response");
    };
    assert_eq!(suggestion.slug.as_str(), "catalogue-design");
    let action = Action::SuggestProjectSlug(
        WORKSPACE,
        SuggestProjectSlug {
            repository: "owner/catalogue".into(),
            config_path: "docs/design.ts".into(),
        },
    );
    let mut queries = Unimock::new(
        MembersMock::members
            .next_call(matching!(_))
            .returns(Ok(vec![member(Role::Member)])),
    );
    assert!(matches!(
        execution(&action).execute(&mut queries),
        Err(Error::InvalidInput)
    ));
}
