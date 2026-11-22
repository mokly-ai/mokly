//! Generation files are immutable while the generation root and selection stay live.

use std::sync::Arc;

use axum::body::Bytes;
use axum::http::{Method, StatusCode};
use mokly_model::namespace::viewer;
use mokly_model::routes;
use unimock::{MockFn, Unimock, matching};

use crate::assets::File;
use crate::comparison_store::ComparisonsMock;
use crate::comparison_support::{accepted, snapshot};
use crate::delivery_support::{application, body, request, router};
use crate::publication::FixedPublication;

#[tokio::test]
async fn comparison_files_are_immutable_while_root_and_selection_are_no_store() {
    let input = accepted(Arc::new(Unimock::new(())), Arc::new(Unimock::new(())));
    let id = input.id.clone();
    let root = format!("/{}", routes::comparison_generation(&id));
    let selection = format!("/{}?path=sample", viewer("diffs/selection"));
    let mut app = application(Arc::new(FixedPublication::new(snapshot(Some(input)))));
    app.comparisons = Some(Arc::new(Unimock::new((
        ComparisonsMock::file
            .each_call(matching!(_, "entries/sample.json"))
            .answers(&|_, _, _| {
                Ok(Some(File {
                    bytes: "{}".into(),
                    content_type: "application/json; charset=utf-8".into(),
                }))
            }),
        ComparisonsMock::file
            .each_call(matching!(_, "snapshots/before/sample/index.html"))
            .answers(&|_, _, _| {
                Ok(Some(File {
                    bytes: "<p>Before</p>".into(),
                    content_type: "text/html; charset=utf-8".into(),
                }))
            }),
        ComparisonsMock::renew.each_call(matching!(_)).returns(true),
        ComparisonsMock::selected
            .each_call(matching!(_, "sample", false))
            .returns(Ok(id)),
    ))));
    let router = router(app);
    for method in [Method::GET, Method::HEAD] {
        for (path, bytes) in [
            ("entries/sample.json", "{}"),
            ("snapshots/before/sample/index.html", "<p>Before</p>"),
        ] {
            let response = request(&router, method.clone(), &format!("{root}{path}"), &[]).await;
            assert_eq!(response.status(), StatusCode::OK);
            assert_eq!(
                response.headers()["cache-control"],
                "private, max-age=31536000, immutable"
            );
            assert_eq!(response.headers()["x-content-type-options"], "nosniff");
            let expected = if method == Method::GET { bytes } else { "" };
            assert_eq!(body(response).await, expected);
        }
        let response = request(&router, method.clone(), &root, &[]).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
        assert_eq!(response.headers()["cache-control"], "no-store");
        assert_eq!(body(response).await, Bytes::new());
        let response = request(&router, method, &selection, &[]).await;
        assert_eq!(response.status(), StatusCode::FOUND);
        assert_eq!(response.headers()["cache-control"], "no-store");
        assert_eq!(response.headers()["location"], root);
    }
}
