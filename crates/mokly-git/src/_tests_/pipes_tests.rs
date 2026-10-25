//! Blob streams validate exact size and stop the process on sink or source failure.

use std::io::{self, Write};

use mokly_platform::processes::ProcessGroupMock;
use unimock::{MockFn, Unimock, matching};

use crate::error::Error;
use crate::pipes::copy;

#[test]
fn copied_bytes_are_exact_and_no_stdout_is_retained() {
    let source = vec![37; 128 * 1024 + 1];
    let mut output = Vec::new();
    assert!(
        copy(
            &mut source.as_slice(),
            &mut output,
            source.len(),
            &Unimock::new(())
        )
        .unwrap()
        .is_empty()
    );
    assert_eq!(output, source);
}

#[test]
fn incorrect_proved_sizes_kill_the_process() {
    for size in [2, 4] {
        let group = Unimock::new(
            ProcessGroupMock::kill
                .next_call(matching!())
                .returns(Ok(())),
        );
        let error = copy(&mut b"abc".as_slice(), &mut Vec::new(), size, &group).unwrap_err();
        assert!(matches!(
            error,
            Error::OutputLimit { limit: 2 } | Error::MalformedOutput
        ));
    }
}

struct BrokenWriter;
impl Write for BrokenWriter {
    fn write(&mut self, _: &[u8]) -> io::Result<usize> {
        Err(io::Error::other("sink failed"))
    }
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

#[test]
fn sink_failures_kill_the_process_and_keep_the_io_category() {
    let group = Unimock::new(
        ProcessGroupMock::kill
            .next_call(matching!())
            .returns(Ok(())),
    );
    assert!(matches!(
        copy(&mut b"abc".as_slice(), &mut BrokenWriter, 3, &group),
        Err(Error::Internal(_))
    ));
}
