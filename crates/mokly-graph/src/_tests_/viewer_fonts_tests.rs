//! A Markdown document's own stylesheet loads the viewer's two faces outside its
//! closure, and every other target outside `static/` still escapes.

use std::sync::{Arc, Mutex};

use mokly_html::diagnostic_code::Code;
use mokly_html::markdown;
use mokly_html::tree::{Node, element};
use mokly_model::axes::ColorScheme;
use mokly_source_interface::tree::SourceTreeMock;
use unimock::{MockFn, Unimock, matching};

use crate::closure::{ClosureBuilder, ClosureObserver, Walker};
use crate::error::GraphError;
use crate::policy::{PublicFile, PublicPolicyMock};
use crate::reference_index::MemoryReferenceIndex;

use super::ViewerFonts;

const ROUTE: &str = "payment/index.html";

/// Every path that the walk records as an observed input.
#[derive(Default)]
struct Observed(Mutex<Vec<String>>);

impl ClosureObserver for Observed {
    fn observe(&self, _route: &str, path: &str) {
        self.0.lock().unwrap().push(path.into());
    }
}

fn walker(observer: Option<Arc<Observed>>, policy: Unimock, tree: Unimock) -> Walker {
    Walker {
        observer: observer.map(|observer| observer as Arc<dyn ClosureObserver>),
        tree: Arc::new(tree),
        policy: Arc::new(policy),
        generated: Arc::new(Unimock::new(())),
        index: Arc::new(MemoryReferenceIndex::default()),
    }
}

/// A document whose head holds one stylesheet with the given text.
fn styled(css: &str) -> Vec<Node> {
    vec![element(
        "html",
        &[],
        vec![element(
            "head",
            &[],
            vec![element("style", &[], vec![Node::Text(css.into())])],
        )],
    )]
}

#[test]
fn a_markdown_document_loads_both_viewer_faces_outside_its_closure() {
    let observed = Arc::new(Observed::default());
    let document = markdown::render(
        "# Terms",
        "Terms",
        ColorScheme::Light,
        ROUTE,
        &Unimock::new(()),
    )
    .unwrap();
    let closure = walker(Some(observed.clone()), Unimock::new(()), Unimock::new(()))
        .collect(ROUTE, &document, &[], ViewerFonts::Permitted)
        .expect("the closure skips the viewer's faces");
    assert!(closure.files.is_empty(), "{:?}", closure.files);
    assert!(closure.edges.is_empty(), "{:?}", closure.edges);
    assert!(closure.evidence.is_empty(), "{:?}", closure.evidence);
    assert!(closure.references.is_empty(), "{:?}", closure.references);
    assert!(closure.warnings.is_empty(), "{:?}", closure.warnings);
    assert!(observed.0.lock().unwrap().is_empty());
}

/// The policy and the source tree of one walk.
type Mocks = fn() -> (Unimock, Unimock);

/// A walk that reads no public file.
fn untouched() -> (Unimock, Unimock) {
    (Unimock::new(()), Unimock::new(()))
}

/// A walk that reaches the authored `theme.css`, which names a viewer face.
fn theme() -> (Unimock, Unimock) {
    let policy = Unimock::new(
        PublicPolicyMock::check
            .each_call(matching!("theme.css"))
            .returns(Ok(PublicFile {
                path: "theme.css".into(),
                absolute: "/repo/theme.css".into(),
            })),
    );
    let tree = Unimock::new((
        SourceTreeMock::prefetch
            .each_call(matching!(_))
            .answers(&|_, _| Ok(())),
        SourceTreeMock::read_public
            .each_call(matching!(_))
            .answers(&|_, _| {
                Ok(b"@font-face{src:url(\"../mokly-viewer/fonts/Geist-Variable.woff2\")}".to_vec())
            }),
    ));
    (policy, tree)
}

#[test]
fn every_other_target_outside_static_still_escapes() {
    let cases: [(ViewerFonts, &str, &str, Mocks, &str); 5] = [
        (
            ViewerFonts::Permitted,
            ROUTE,
            "@font-face{src:url(\"../../../mokly-viewer/fonts/Geist-OFL.txt\")}",
            untouched,
            "../../../mokly-viewer/fonts/Geist-OFL.txt",
        ),
        (
            ViewerFonts::Permitted,
            ROUTE,
            "@font-face{src:url(\"../../../fonts/Geist-Variable.woff2\")}",
            untouched,
            "../../../fonts/Geist-Variable.woff2",
        ),
        (
            ViewerFonts::Permitted,
            ROUTE,
            "@font-face{src:url(\"/mokly-viewer/fonts/Geist-Variable.woff2\")}",
            untouched,
            "/mokly-viewer/fonts/Geist-Variable.woff2",
        ),
        (
            ViewerFonts::Denied,
            "payment/index.mobile.html",
            "@font-face{src:url(\"../../../mokly-viewer/fonts/Geist-Variable.woff2\")}",
            untouched,
            "../../../mokly-viewer/fonts/Geist-Variable.woff2",
        ),
        (
            ViewerFonts::Permitted,
            ROUTE,
            "@import \"../../theme.css\";",
            theme,
            "../mokly-viewer/fonts/Geist-Variable.woff2",
        ),
    ];
    for (fonts, route, css, mocks, url) in cases {
        let (policy, tree) = mocks();
        let result = walker(None, policy, tree).collect(route, &styled(css), &[], fonts);
        let expected = format!("{route}: invalid resource URL \"{url}\": unsafe or escaping URL");
        assert!(
            matches!(
                &result,
                Err(GraphError::Invalid { code: Code::BuildInvalid, route: failed, message })
                    if failed == route && *message == expected
            ),
            "{css}: {result:?}"
        );
    }
}
