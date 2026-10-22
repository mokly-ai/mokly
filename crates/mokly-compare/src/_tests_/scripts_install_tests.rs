//! A cache miss carries the probed executable into the actual installation.

use std::path::Path;
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::cache_types::{CacheMock, Lease, StorageMock};
use crate::commands::CommandsMock;
use crate::dependencies::{Dependencies, DependencyTiers};
use crate::dependency_types::Tier;

use super::dependencies_tests::{request, tiers};

#[test]
fn a_scripts_on_install_uses_the_probed_executable() {
    let mut request = request();
    request.head.files.clear();
    request.install_scripts = true;
    let executable = if cfg!(windows) {
        "C:/node/node.exe"
    } else {
        "/node/bin/node"
    };
    let boundaries = Unimock::new((
        CommandsMock::run.next_call(matching!((command) if command.program == "npm" && command.node.is_none()))
            .returns(Ok(b"11.0.0\n".to_vec())),
        CommandsMock::run.next_call(matching!((command) if command.program == "node" && command.node.is_none()))
            .returns(Ok(format!(r#"{{"version":"v24.21.0","platform":"linux","architecture":"arm64","executable":"{executable}"}}"#).into_bytes())),
        CacheMock::get.next_call(matching!(_, _, _)).answers(&|_, _, _, builder| {
            builder.build(Path::new("/install"))?;
            Ok(Lease { directory: "/install".into(), guard: Box::new(Unimock::new(())) })
        }),
        StorageMock::copy.next_call(matching!(_, _, _)).returns(Ok(())),
        CommandsMock::run.next_call(matching!(_)).answers(&|_, command| {
            let executable = if cfg!(windows) { "C:/node/node.exe" } else { "/node/bin/node" };
            assert_eq!(command.node.as_deref(), Some(Path::new(executable)));
            assert!(!command.args.iter().any(|arg| arg == "--ignore-scripts"));
            Ok(Vec::new())
        }),
        StorageMock::remove.next_call(matching!(_)).returns(Ok(())),
    ));
    let defaults = tiers(boundaries.clone(), boundaries.clone());
    let owner = DependencyTiers {
        storage: Arc::new(boundaries),
        ..defaults
    };
    assert_eq!(owner.resolve(&request).unwrap().tier, Tier::Installed);
}
