//! Failed physical reads cannot match a recorded missing candidate.

use std::collections::BTreeMap;
use std::io::{self, ErrorKind};

use mokly_sidecar::compiled::{PhysicalInput, ReuseEvidence};
use mokly_source_interface::error::SourceError;
use unimock::{MockFn, Unimock, matching};

use crate::physical_inputs::{PhysicalInputsMock, current};

#[test]
fn read_errors_reject_recorded_absence_and_incomplete_records_never_read() {
    let mut evidence = ReuseEvidence {
        complete: true,
        inputs: BTreeMap::from([("/outside/jsconfig.json".into(), PhysicalInput::Absent)]),
    };
    let reader = Unimock::new(
        PhysicalInputsMock::matches
            .some_call(matching!(_, _))
            .returns(Err(SourceError::Io {
                operation: "read",
                path: "/outside/jsconfig.json".into(),
                source: io::Error::from(ErrorKind::PermissionDenied),
            })),
    );
    assert!(!current(&evidence, &reader));
    evidence.complete = false;
    assert!(!current(&evidence, &Unimock::new(())));
}
