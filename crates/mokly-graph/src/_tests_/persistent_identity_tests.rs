//! Native and compilation metadata select stored documents independently of bundle epochs.

use std::sync::{Arc, Mutex};

use mokly_catalogue::render_sources::{JavaScriptGeneration, RenderSource};
use unimock::{MockFn, Unimock, matching};

use crate::collection::ComparisonCollectorMock;
use crate::document_store::{DocumentStoreMock, Persistence, ReadOutcome, StoreKey};
use crate::types::RenderGeneration;

use super::{collection_support, persistent_session_tests};

#[test]
fn stored_reads_require_equal_document_native_and_extra_compilation_identities() {
    let retained = Arc::new(Mutex::new(None::<StoreKey>));
    let saved = persistent_session_tests::artifact();
    for (native, metadata, document, epoch, expected) in [
        (
            Some("native-A:linux:version-A"),
            Some("toolchain-A:config-A"),
            "page-000/index.html",
            "first",
            true,
        ),
        (
            Some("native-A:linux:version-A"),
            Some("toolchain-A:config-A"),
            "page-000/index.html",
            "unrelated-module-edited",
            true,
        ),
        (
            Some("native-B:linux:version-A"),
            Some("toolchain-A:config-A"),
            "page-000/index.html",
            "first",
            false,
        ),
        (
            Some("native-A:macos:version-A"),
            Some("toolchain-A:config-A"),
            "page-000/index.html",
            "first",
            false,
        ),
        (
            Some("native-A:linux:version-B"),
            Some("toolchain-A:config-A"),
            "page-000/index.html",
            "first",
            false,
        ),
        (
            Some("native-A:linux:version-A"),
            Some("toolchain-B:config-A"),
            "page-000/index.html",
            "first",
            false,
        ),
        (
            Some("native-A:linux:version-A"),
            Some("toolchain-A:config-B"),
            "page-000/index.html",
            "first",
            false,
        ),
        (
            Some("native-A:linux:version-A"),
            Some("toolchain-A:config-A"),
            "changed-document-key",
            "first",
            false,
        ),
        (
            Some("native-A:linux:version-A"),
            None,
            "page-000/index.html",
            "first",
            false,
        ),
        (
            None,
            Some("toolchain-A:config-A"),
            "page-000/index.html",
            "first",
            false,
        ),
    ] {
        let mut probe = collection_support::probe(1);
        probe.session.render_all().unwrap();
        let mut collector = Unimock::new(
            ComparisonCollectorMock::collect
                .each_call(matching!(_, _))
                .answers(&|_, _, _| Ok(())),
        );
        probe.session.collect_comparison(&mut collector).unwrap();
        let source = probe
            .session
            .comparison_document("page-000/index.html")
            .unwrap();
        probe.renders.lock().unwrap().clear();
        let state = Arc::get_mut(&mut probe.session.state).unwrap();
        Arc::make_mut(&mut state.plans)
            .get_mut("page-000/index.html")
            .unwrap()
            .key
            .0 = document.into();
        let catalogue = Arc::make_mut(&mut state.catalogue);
        catalogue.javascript.generation = Some(JavaScriptGeneration {
            id: epoch.into(),
            ..Default::default()
        });
        catalogue
            .javascript
            .entries
            .insert("page-000".into(), RenderSource::default());
        let identity = DocumentStoreMock::identity
            .some_call(matching!())
            .returns(native.map(str::to_owned));
        let store = if native.is_some() && metadata.is_some() {
            let value = saved.clone();
            let known = retained.clone();
            Unimock::new((
                identity,
                DocumentStoreMock::load
                    .some_call(matching!(_))
                    .answers_arc(Arc::new(move |_, key| {
                        let mut known = known.lock().unwrap();
                        let expected = known.get_or_insert_with(|| key.clone());
                        if expected == key {
                            ReadOutcome::Hit(value.clone())
                        } else {
                            ReadOutcome::Miss
                        }
                    })),
            ))
        } else {
            Unimock::new(identity)
        };
        state.inputs.persistence = Some(Persistence {
            store: Arc::new(store),
            javascript: metadata.map(str::to_owned),
        });
        let result = probe
            .session
            .comparison_document("page-000/index.html")
            .unwrap();
        assert_eq!(
            result.bytes,
            if expected {
                &saved.bytes
            } else {
                &source.bytes
            }
            .to_vec(),
            "native={native:?}, metadata={metadata:?}, document={document}, epoch={epoch}"
        );
        assert_eq!(probe.renders.lock().unwrap().len(), usize::from(!expected));
    }
}
