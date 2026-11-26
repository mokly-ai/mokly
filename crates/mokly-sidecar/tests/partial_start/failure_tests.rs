//! Unix children can create a descendant before attachment completes.

use std::io;
use std::path::PathBuf;
use std::sync::Arc;

use mokly_platform::error;
use mokly_platform::processes::{
    AttachFailure, ProcessGroup, ProcessGroupMock, ProcessGroups, ProcessGroupsMock, ProcessTree,
    SystemProcessGroups,
};
use mokly_sidecar::error::{Error, InternalError};
use mokly_sidecar::process_clock::SystemClock;
use mokly_sidecar::process_factory::NodeFactory;
use mokly_sidecar::process_memory::SystemMemory;
use mokly_sidecar::workers::{Diagnostics, SpawnFailure, WorkerFactory};
use mokly_test_support::capture::Trace;
use unimock::{MockFn, Unimock, matching};

use crate::partial_start::fixture::Tree;
use crate::partial_start::threads::FailThread;

struct Quiet;
impl Diagnostics for Quiet {
    fn emit(&self, _: &str) {}
}

#[test]
fn attachment_failure_stops_and_reaps_the_created_tree() {
    let tree = Arc::new(Tree::new());
    let ready = tree.clone();
    let groups = Unimock::new((
        ProcessGroupsMock::configure
            .some_call(matching!(_))
            .answers(&|_, command| SystemProcessGroups.configure(command)),
        ProcessGroupsMock::attach
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, child| {
                ready.ready(child.id());
                Err(AttachFailure {
                    child,
                    source: error::Error::Locked {
                        path: "injected attachment failure".into(),
                    },
                })
            })),
        ProcessGroupsMock::kill_unattached
            .some_call(matching!(_))
            .answers(&|_, child| {
                let result = SystemProcessGroups.kill_unattached(child);
                println!("unattached tree kill: {result:?}");
                result
            }),
    ));
    let factory = factory(groups);
    let failure = factory.spawn(&tree.launch()).err().unwrap();
    assert!(
        matches!(&failure, SpawnFailure::Started(Error::Internal(InternalError::Platform { source: error::Error::Locked { path } })) if path == &PathBuf::from("injected attachment failure")),
        "{failure:?}"
    );
    tree.assert_stopped();
}

#[test]
fn rejected_completion_thread_stops_and_reaps_the_created_tree() {
    let tree = Arc::new(Tree::new());
    let ready = tree.clone();
    let groups = Unimock::new((
        ProcessGroupsMock::configure
            .some_call(matching!(_))
            .answers(&|_, command| SystemProcessGroups.configure(command)),
        ProcessGroupsMock::attach
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, child| {
                ready.ready(child.id());
                let (child, group) = SystemProcessGroups.attach(child)?.into_parts();
                let group: Arc<dyn ProcessGroup> = Arc::from(group);
                let guard =
                    Unimock::new(ProcessGroupMock::kill.some_call(matching!()).answers_arc(
                        Arc::new(move |_| {
                            let result = group.kill();
                            println!("attached tree kill: {result:?}");
                            result
                        }),
                    ));
                Ok(ProcessTree::new(child, Box::new(guard)))
            })),
    ));
    let trace = Trace::default();
    let failure = trace.in_scope(|| {
        factory(groups)
            .with_threads(Arc::new(FailThread(4, Default::default())))
            .spawn(&tree.launch())
            .err()
            .unwrap()
    });
    assert!(
        matches!(&failure, SpawnFailure::Started(Error::Internal(InternalError::Io { source })) if source.kind() == io::ErrorKind::ResourceBusy),
        "{failure:?}"
    );
    tree.assert_stopped();
}

#[test]
fn partial_pipe_failure_keeps_the_startup_error_when_tree_kill_fails() {
    let tree = Arc::new(Tree::new());
    let ready = tree.clone();
    let groups = Unimock::new((
        ProcessGroupsMock::configure
            .some_call(matching!(_))
            .answers(&|_, command| SystemProcessGroups.configure(command)),
        ProcessGroupsMock::attach
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, child| {
                ready.ready(child.id());
                let guard =
                    Unimock::new(ProcessGroupMock::kill.some_call(matching!()).answers(&|_| {
                        Err(error::Error::Locked {
                            path: "injected tree kill failure".into(),
                        })
                    }));
                Ok(ProcessTree::new(child, Box::new(guard)))
            })),
        ProcessGroupsMock::kill_unattached
            .some_call(matching!(_))
            .answers(&|_, child| {
                let result = SystemProcessGroups.kill_unattached(child);
                println!("unattached fallback kill: {result:?}");
                result
            }),
    ));
    let trace = Trace::default();
    let failure = trace.in_scope(|| {
        factory(groups)
            .with_threads(Arc::new(FailThread(3, Default::default())))
            .spawn(&tree.launch())
            .err()
            .unwrap()
    });
    println!(
        "startup result: {failure:?}; cleanup events: {:?}",
        trace.events()
    );
    tree.assert_stopped();
    assert!(
        matches!(&failure, SpawnFailure::Started(Error::Internal(InternalError::Io { source })) if source.kind() == io::ErrorKind::ResourceBusy),
        "{failure:?}"
    );
    assert!(trace.events().iter().any(|event| {
        event
            .fields
            .contains(&("operation".into(), "tree.kill".into()))
    }));
}

fn factory(groups: Unimock) -> NodeFactory {
    NodeFactory::new(
        Arc::new(groups),
        Arc::new(SystemClock::default()),
        Arc::new(Quiet),
        Arc::new(SystemMemory),
    )
}
