//! A proof replays only the proven walk prefix before reading each lexical target.

use std::collections::BTreeSet;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use mokly_graph::closure::ClosureBuilderMock;
use mokly_graph::error::GraphError;
use mokly_graph::head_validation::{ClosureFacts, ValidationRead, ValidationRecorder};
use mokly_graph::head_walks::{WalkRecord, WalkStep};
use mokly_graph::types::RenderGenerationMock;
use unimock::{MockFn, Unimock, matching};

use crate::reuse_budget::Resident;
use crate::validation_arena::Replay;
use crate::validation_head::Head;
use crate::validation_inputs::arena_bytes;
use crate::validation_recording::Recording;

#[derive(Debug, Eq, PartialEq)]
enum Event {
    Observe(String),
    Read(ValidationRead, String),
}

#[test]
fn fact_proof_observes_each_target_before_reading_and_stops_before_unproved_children() {
    for (changed, failed_attachment, background) in [
        (false, false, false),
        (true, false, false),
        (false, true, false),
        (false, true, true),
    ] {
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
                None,
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
                    observed.lock().unwrap().push(Event::Observe(path.into()));
                    if failed_attachment {
                        Err(GraphError::InputsChanged { path: path.into() })
                    } else {
                        Ok(())
                    }
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
        let result = if background {
            let head = Head::new(
                Arc::new(boundary.clone()),
                resident.clone(),
                None,
                Some(current.id),
                false,
            );
            head.replay_pass(
                "home/index.html",
                Some([2; 32]),
                WalkRecord {
                    steps: vec![
                        WalkStep::Read(ValidationRead::Policy, "".into(), [1; 32]),
                        WalkStep::Read(ValidationRead::Document, "home/index.html".into(), [1; 32]),
                        WalkStep::Observe("root.css".into()),
                        WalkStep::Read(
                            ValidationRead::PublicTarget,
                            "static/root.css".into(),
                            [1; 32],
                        ),
                        WalkStep::Read(
                            ValidationRead::StaticContent,
                            "static/root.css".into(),
                            [1; 32],
                        ),
                        WalkStep::Observe("child.png".into()),
                    ],
                    closure: ClosureFacts::default(),
                },
                &boundary,
                None,
            )
        } else {
            resident.with_optional([Some(previous.id), Some(current.id)], |arenas| {
                let replay = Replay {
                    current: arenas[1],
                    resident: &resident,
                    generation: &boundary,
                };
                arenas[0]
                    .unwrap()
                    .reuse(&replay, "home/index.html", [2; 32], &boundary, None)
            })
        };
        let mut expected = Vec::new();
        if background {
            expected.push(Event::Read(ValidationRead::Policy, "".into()));
        }
        expected.extend([
            Event::Read(ValidationRead::Policy, "".into()),
            Event::Read(ValidationRead::Document, "home/index.html".into()),
            Event::Observe("root.css".into()),
        ]);
        if !failed_attachment {
            expected.extend([
                Event::Read(ValidationRead::PublicTarget, "static/root.css".into()),
                Event::Read(ValidationRead::StaticContent, "static/root.css".into()),
            ]);
        }
        if !changed && !failed_attachment {
            expected.extend([
                Event::Observe("child.png".into()),
                Event::Read(ValidationRead::PublicTarget, "static/child.png".into()),
                Event::Read(ValidationRead::StaticContent, "static/child.png".into()),
            ]);
        }
        let actual = result
            .map(|closure| closure.map(|closure| closure.files))
            .map_err(|error| {
                let GraphError::InputsChanged { path } = error else {
                    panic!("unexpected replay error: {error}")
                };
                path
            });
        assert_eq!(
            *events.lock().unwrap(),
            expected,
            "changed root: {changed}, failed attachment: {failed_attachment}"
        );
        assert_eq!(
            actual,
            if failed_attachment {
                Err(PathBuf::from("root.css"))
            } else {
                Ok((!changed).then(|| BTreeSet::from(["root.css".into(), "child.png".into()])))
            }
        );
    }
}
