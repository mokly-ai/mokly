//! The validated attempt starts source work before the working bundle and drains failures.

use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

use mokly_cli::grammar::Common;
use mokly_cli::serve::ServePreparation;
use mokly_cli::serve_settings::ServeSettings;
use mokly_render::runtime::Runtime;
use mokly_sidecar::error::{Error, ProtocolError};
use mokly_sidecar::methods::Call;
use mokly_sidecar::pool::PoolMock;
use mokly_source_interface::tree::{Child, FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::serve_eager::EagerStartsMock;
use crate::warning_support::config;

use super::AttemptPreparation;

#[test]
fn eager_source_starts_before_the_head_bundle_and_a_failed_head_drains_it() {
    let events = Arc::new(Mutex::new(Vec::new()));
    let starting = events.clone();
    let cancelling = events.clone();
    let eager = Unimock::new((
        EagerStartsMock::start
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                starting.lock().unwrap().push("source")
            })),
        EagerStartsMock::discard
            .some_call(matching!())
            .answers_arc(Arc::new(move |_| {
                cancelling.lock().unwrap().push("cancel and join")
            })),
    ))
    .no_verify_in_drop();
    let tree = Arc::new(Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, path| {
                let kind = if path == Path::new("/repo") || path == Path::new("/repo/specs") {
                    FileKind::Directory
                } else if path == Path::new("/repo/mokly.config.json")
                    || path == Path::new("/repo/specs/card.mockup.ts")
                {
                    FileKind::File
                } else {
                    return Ok(None);
                };
                Ok(Some(Node {
                    identity: path.into(),
                    kind,
                    lexical_kind: kind,
                }))
            }),
        SourceTreeMock::read
            .each_call(matching!(_))
            .answers(&|_, _| Ok(b"{}".to_vec())),
        SourceTreeMock::prefetch
            .each_call(matching!(_))
            .answers(&|_, _| Ok(())),
        SourceTreeMock::children
            .each_call(matching!(_))
            .answers(&|_, _| {
                Ok(vec![Child {
                    name: "card.mockup.ts".into(),
                    kind: FileKind::File,
                }])
            }),
    )));
    let bundling = events.clone();
    let preparation = AttemptPreparation {
        eager: Some(Arc::new(eager)),
        settings: ServeSettings::new(&config()),
        tree: tree.clone(),
        head_published: Arc::new(AtomicBool::new(false)),
        runtime: Arc::new(Runtime::new(
            tree.clone(),
            tree,
            Arc::new(Unimock::new(())),
            Arc::new(Unimock::new(
                PoolMock::request
                    .some_call(matching!((call) if matches!(call, Call::Bundle(_))))
                    .answers_arc(Arc::new(move |_, _| {
                        bundling.lock().unwrap().push("head bundle");
                        Err(Error::Protocol(ProtocolError::Handshake))
                    })),
            )),
            Arc::new(Unimock::new(())),
            Arc::new(Unimock::new(())),
            "test".into(),
            None,
        )),
    };
    let result = preparation.prepare(Path::new("/repo"), &Common::default());
    assert!(result.is_err());
    assert_eq!(
        *events.lock().unwrap(),
        ["source", "head bundle", "cancel and join"]
    );
}
