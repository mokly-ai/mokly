//! CLI identity grammar and canonical persistence without provider access.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use crate::repository::RepositoryIdentity;

#[test]
fn canonical_identities_remove_one_git_suffix_and_fold_owner_and_name() {
    for (input, expected) in [
        ("Mokly-AI/Mokly-Cloud", "mokly-ai/mokly-cloud"),
        (
            "github.com/Mokly-AI/Mokly-Cloud.git",
            "mokly-ai/mokly-cloud",
        ),
        (
            "gitlab.com/Team/Subgroup/Project.git",
            "gitlab.com/team/subgroup/project",
        ),
        ("192.168.1.2/Team/Project", "192.168.1.2/team/project"),
        (
            "git.example/Team/Project.git.git",
            "git.example/team/project.git",
        ),
    ] {
        assert_eq!(
            RepositoryIdentity::parse(input).unwrap().canonical(),
            expected
        );
    }
}

#[test]
fn malformed_hosts_paths_and_segments_are_rejected() {
    for input in [
        "",
        "project",
        "/owner/project",
        "owner/",
        "owner/../project",
        "github.com/group/subgroup/project",
        "GitHub.com/owner/project",
        "https://github.com/owner/project",
        "git.example:443/owner/project",
        "git@example.com:owner/project",
        "-git.example/owner/project",
        "git-.example/owner/project",
        "git..example/owner/project",
        "git.example/owner//project",
        "git.example/./project",
        "git.example/owner/..",
        "owner/.git",
        "git.example/owner/project/",
        "git.example/équipe/project",
        " owner/project",
        "owner/project\n",
        "owner/project?query",
        "owner/pro ject",
    ] {
        assert!(RepositoryIdentity::parse(input).is_none(), "{input:?}");
    }
}

#[test]
fn host_owner_and_name_byte_limits_are_independent() {
    let host = [
        "a".repeat(63),
        "b".repeat(63),
        "c".repeat(63),
        "d".repeat(61),
    ]
    .join(".");
    let owner = "x".repeat(255);
    let name = "y".repeat(255);
    assert!(RepositoryIdentity::from_parts(&host, &owner, &name).is_some());
    assert!(RepositoryIdentity::from_parts(&(host + "d"), &owner, &name).is_none());
    assert!(RepositoryIdentity::from_parts("git.example", &(owner + "x"), &name).is_none());
    assert!(RepositoryIdentity::from_parts("git.example", "owner", &(name + "y")).is_none());
    assert!(
        RepositoryIdentity::parse(&format!("{}.example/owner/project", "a".repeat(64))).is_none()
    );
    assert!(
        RepositoryIdentity::parse(&format!(
            "git.example/{}/{}",
            "a".repeat(128),
            "b".repeat(128)
        ))
        .is_some()
    );
    assert!(
        RepositoryIdentity::from_parts(
            "git.example",
            &format!("{}/{}", "a".repeat(128), "b".repeat(127)),
            "project"
        )
        .is_none()
    );
}
