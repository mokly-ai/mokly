//! The executable supplies the npm version to the graph composition root.

use std::sync::Arc;

use mokly_cli::cancellation::BuildCancellation;
use mokly_cli::version::VERSION;
use unimock::Unimock;

#[test]
fn graph_runtime_version_equals_the_embedded_npm_version() {
    let runtime = super::runtime(
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Arc::new(BuildCancellation::new(Arc::new(Unimock::new(())))),
    );
    assert_eq!(runtime.version, VERSION);
}
