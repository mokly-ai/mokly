//! Yarn Classic checks manifest values from the folder that Classic uses.

use std::collections::BTreeMap;

use mokly_git::identity::RepoPath;

use crate::error::{Error, Result};
use crate::local_packages::validate;

fn classic(app: serde_json::Value) -> Result<()> {
    validate(
        &[
            (
                "package.json",
                r#"{"private":true,"workspaces":["packages/*"]}"#.to_owned(),
            ),
            ("packages/app/package.json", app.to_string()),
            ("yarn.lock", "# yarn lockfile v1\n".to_owned()),
        ]
        .into_iter()
        .map(|(path, bytes)| (RepoPath::parse(path).unwrap(), bytes.into_bytes()))
        .collect::<BTreeMap<_, _>>(),
    )
}

#[test]
fn classic_file_and_link_dependencies_use_their_manifest_folder() {
    let result = classic(serde_json::json!({
        "dependencies": { "x": "file:../x.tgz" },
        "devDependencies": { "y": "link:../linked" },
        "optionalDependencies": { "z": "file:./vendor/z" },
    }));
    assert!(result.is_ok(), "{result:?}");
}

#[test]
fn classic_values_that_leave_the_repository_still_fall_back() {
    for app in [
        serde_json::json!({ "dependencies": { "x": "file:../../../x.tgz" } }),
        serde_json::json!({ "devDependencies": { "y": "link:../../../linked" } }),
        serde_json::json!({ "dependencies": { "x": "../x.tgz" } }),
        serde_json::json!({ "dependencies": { "x": "FILE:../x.tgz" } }),
        serde_json::json!({ "resolutions": { "x": "file:../x.tgz" } }),
    ] {
        assert!(
            matches!(classic(app.clone()), Err(Error::LocalOutside { .. })),
            "{app}"
        );
    }
}
