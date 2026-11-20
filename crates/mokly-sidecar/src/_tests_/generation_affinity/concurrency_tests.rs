//! A busy preferred holder does not reduce parallel render capacity.

use std::sync::{Arc, Mutex, mpsc};
use std::thread;

use unimock::{MockFn, Unimock, matching};

use crate::methods::Call;
use crate::pool::SidecarPool;
use crate::wire::MethodResult;
use crate::workers::WorkerMock;

use super::support::{Loaded, pool, render};

#[test]
fn parallel_renders_use_every_available_slot_without_starting_processes() {
    let pool = Arc::new(pool(&[
        ("/head", Loaded::None),
        ("/head", Loaded::Ready),
        ("/head", Loaded::None),
    ]));
    let (entered, observed) = mpsc::channel();
    let mut releases = Vec::new();
    {
        let mut state = pool.lock();
        for (index, slot) in state.slots.iter_mut().enumerate() {
            let (release, gate) = mpsc::channel();
            releases.push(release);
            let gate = Mutex::new(gate);
            let entered = entered.clone();
            slot.as_mut().unwrap().worker = Box::new(Unimock::new((
                WorkerMock::request
                    .each_call(matching!(_, _))
                    .answers_arc(Arc::new(move |_, request, _| {
                        if matches!(request.call, Call::RenderPage(_)) {
                            entered.send(index).unwrap();
                            gate.lock().unwrap().recv().unwrap();
                        }
                        Ok(MethodResult::Empty)
                    })),
                WorkerMock::resident_bytes
                    .some_call(matching!())
                    .returns(Ok(0)),
            )));
        }
    }
    let mut threads = Vec::new();
    let mut selected = Vec::new();
    for _ in 0..3 {
        let pool = pool.clone();
        threads.push(thread::spawn(move || pool.request(render()).unwrap()));
        selected.push(observed.recv().unwrap());
    }
    let capacity = pool.lock().slots.len();
    for release in releases {
        release.send(()).unwrap();
    }
    for thread in threads {
        assert!(matches!(thread.join().unwrap(), MethodResult::Empty));
    }
    assert_eq!(selected, [1, 0, 2]);
    assert_eq!(capacity, 3);
    assert_eq!(pool.lock().slots.len(), 3);
}
