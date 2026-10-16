//! Timeout requests retain logical CSS names for head and base dependency inputs.

use std::sync::{Arc, Mutex};

use mokly_sidecar::error::Error;
use mokly_sidecar::methods::{Call, ModuleResolution};
use mokly_sidecar::pool::PoolMock;
use unimock::{MockFn, Unimock, matching};

use crate::postcss::PostCss;
use crate::postcss_cache::CssCache;
use crate::side::SideInputs;

#[test]
fn timeout_labels_use_the_logical_source_even_with_external_dependency_roots() {
    for path in [
        "styles/input.css",
        "node_modules/.mokly-roots/1/theme/input.css",
    ] {
        let pool = Arc::new(Unimock::new(
            PoolMock::request
                .next_call(matching!(_))
                .answers_arc(Arc::new(move |_, call| {
                    assert!(
                        matches!(&call, Call::ProcessCss(params) if params.source_path == path)
                    );
                    Err(Error::RequestTimeout {
                        call: Box::new(call),
                        deadline_ms: 60_000,
                    })
                })),
        ));
        let postcss = PostCss {
            usage: Arc::new(Unimock::new(())),
            pool,
            tree: Arc::new(Unimock::new(())),
            inventory_tree: Arc::new(Unimock::new(())),
            root: "/head".into(),
            side: SideInputs {
                dependency_aliases: Default::default(),
                source_root: "/base".into(),
                repository_roots: vec!["/head".into()],
                module_resolution: ModuleResolution::default(),
                configuration_directory: String::new(),
                context: "base".into(),
                dependency_roots: vec![
                    "/installed/one/node_modules".into(),
                    "/installed/two/node_modules".into(),
                ],
            },
            module: "/head/postcss.mjs".into(),
            cache: Arc::new(Mutex::new(CssCache::default())),
            resolver: Arc::new(Unimock::new(())),
        };
        let error = postcss.process_css(path, "a {}").unwrap_err();
        assert_eq!(
            error.diagnostic().unwrap().message,
            format!("postcss.mjs for {path} exceeded 60000ms")
        );
    }
}
