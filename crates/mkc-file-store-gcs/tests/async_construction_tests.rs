//! Production transport construction from inside an async runtime.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::sync::Arc;

use mkc_file_store_gcs::transport::{HttpFactory, ReqwestHttpFactory};
use unimock::Unimock;

#[tokio::test]
async fn first_transport_build_succeeds_inside_an_async_runtime() {
    for _ in 0..2 {
        let transport = ReqwestHttpFactory.build(Arc::new(Unimock::new(())));
        assert!(transport.is_ok());
    }
}
