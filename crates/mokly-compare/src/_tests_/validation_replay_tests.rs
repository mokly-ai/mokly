//! A proof replays only the proven walk prefix before reading each lexical target.

use std::collections::BTreeSet;
use std::sync::{Arc, Mutex};

use mokly_graph::closure::ClosureBuilderMock;
use mokly_graph::head_validation::{ClosureFacts, ValidationRead, ValidationRecorder};
use mokly_graph::types::RenderGenerationMock;
use unimock::{MockFn, Unimock, matching};

use crate::reuse_budget::Resident;
use crate::validation_inputs::arena_bytes;
use crate::validation_recording::Recording;

#[derive(Debug, Eq, PartialEq)]
enum Event {
    Observe(String),
    Read(ValidationRead, String),
}

#[test]
fn fact_proof_observes_each_target_before_reading_and_stops_before_unproved_children() {
    for changed in [false, true] {
        let resident = Resident::new(1024 * 1024);
        let previous = resident.register_optional(arena_bytes()).unwrap();
        let original = Unimock::new(
            RenderGenerationMock::validation_identity
                .each_call(matching!(_, _))
                .returns(Some([1; 32])),
        );
        resident.with_optional([Some(previous.id), None], |arenas| {
            arenas[0].unwrap().begin(&resident, "home/index.html")
        });
        let recording = Recording {
            resident: &resident,
            arena: Some(previous.id),
            generation: &original,
            route: "home/index.html",
        };
        recording.input(ValidationRead::Policy, "");
        recording.input(ValidationRead::Document, "home/index.html");
        for path in ["root.css", "child.png"] {
            recording.observe(path);
            recording.content(
                ValidationRead::PublicTarget,
                &format!("static/{path}"),
                Some([1; 32]),
            );
            recording.content(
                ValidationRead::StaticContent,
                &format!("static/{path}"),
                Some([1; 32]),
            );
        }
        resident.with_optional([Some(previous.id), None], |arenas| {
            arenas[0].unwrap().finish(
                "home/index.html",
                Some([2; 32]),
                &ClosureFacts {
                    files: BTreeSet::from(["root.css".into(), "child.png".into()]),
                    ..Default::default()
                },
            )
        });
        let current = resident.register_optional(arena_bytes()).unwrap();
        let events = Arc::new(Mutex::new(Vec::new()));
        let observed = events.clone();
        let read = events.clone();
        let boundary = Unimock::new((
            ClosureBuilderMock::observe
                .each_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, _, path| {
                    observed.lock().unwrap().push(Event::Observe(path.into()))
                })),
            RenderGenerationMock::validation_identity
                .each_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, kind, route| {
                    read.lock().unwrap().push(Event::Read(kind, route.into()));
                    Some(
                        if changed
                            && kind == ValidationRead::StaticContent
                            && route == "static/root.css"
                        {
                            [9; 32]
                        } else {
                            [1; 32]
                        },
                    )
                })),
        ));
        let result = resident.with_optional([Some(previous.id), Some(current.id)], |arenas| {
            arenas[0].unwrap().reuse(
                arenas[1],
                &resident,
                &boundary,
                "home/index.html",
                [2; 32],
                &boundary,
            )
        });
        let mut expected = vec![
            Event::Read(ValidationRead::Policy, "".into()),
            Event::Read(ValidationRead::Document, "home/index.html".into()),
            Event::Observe("root.css".into()),
            Event::Read(ValidationRead::PublicTarget, "static/root.css".into()),
            Event::Read(ValidationRead::StaticContent, "static/root.css".into()),
        ];
        if !changed {
            expected.extend([
                Event::Observe("child.png".into()),
                Event::Read(ValidationRead::PublicTarget, "static/child.png".into()),
                Event::Read(ValidationRead::StaticContent, "static/child.png".into()),
            ]);
        }
        assert_eq!(*events.lock().unwrap(), expected, "changed root: {changed}");
        assert_eq!(
            result.map(|closure| closure.files),
            (!changed).then(|| BTreeSet::from(["root.css".into(), "child.png".into()]))
        );
    }
}
