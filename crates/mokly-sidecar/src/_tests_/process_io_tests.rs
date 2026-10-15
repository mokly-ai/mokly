//! Split UTF-8, line order, bounded carry, and EOF forwarding use fake input.

use unimock::{MockFn, Unimock, matching};

use crate::workers::DiagnosticsMock;

use super::{DiagnosticInputMock, forward_diagnostics};

#[test]
fn diagnostic_lines_preserve_split_utf8_and_flush_the_eof_tail() {
    const FIRST: &[u8] = b"first\n\xe2";
    const SECOND: &[u8] = b"\x82\xacuro\nlast";
    let mut reader = Unimock::new((
        DiagnosticInputMock::read
            .next_call(matching!(_))
            .answers(&|_, output| {
                output[..FIRST.len()].copy_from_slice(FIRST);
                Ok(FIRST.len())
            }),
        DiagnosticInputMock::read
            .next_call(matching!(_))
            .answers(&|_, output| {
                output[..SECOND.len()].copy_from_slice(SECOND);
                Ok(SECOND.len())
            }),
        DiagnosticInputMock::read
            .next_call(matching!(_))
            .returns(Ok(0)),
    ));
    let diagnostics = Unimock::new((
        DiagnosticsMock::emit
            .next_call(matching!("first"))
            .returns(()),
        DiagnosticsMock::emit
            .next_call(matching!("€uro"))
            .returns(()),
        DiagnosticsMock::emit
            .next_call(matching!("last"))
            .returns(()),
    ));
    forward_diagnostics(&mut reader, &diagnostics);
}

#[test]
fn long_lines_keep_a_bounded_carry_without_losing_bytes() {
    let mut reader = Unimock::new((
        DiagnosticInputMock::read
            .next_call(matching!(_))
            .answers(&|_, output| {
                output.fill(b'x');
                Ok(output.len())
            })
            .n_times(17),
        DiagnosticInputMock::read
            .next_call(matching!(_))
            .returns(Ok(0)),
    ));
    let diagnostics = Unimock::new((
        DiagnosticsMock::emit
            .next_call(matching!((text) if text.len() == 65_536 && text.bytes().all(|b| b == b'x')))
            .returns(()),
        DiagnosticsMock::emit
            .next_call(matching!((text) if text.len() == 4096 && text.bytes().all(|b| b == b'x')))
            .returns(()),
    ));
    forward_diagnostics(&mut reader, &diagnostics);
}

#[test]
fn invalid_utf8_cannot_underflow_the_bounded_buffer_split() {
    let mut reader = Unimock::new((
        DiagnosticInputMock::read
            .next_call(matching!(_))
            .answers(&|_, output| {
                output.fill(0x80);
                Ok(output.len())
            })
            .n_times(17),
        DiagnosticInputMock::read
            .next_call(matching!(_))
            .returns(Ok(0)),
    ));
    let diagnostics = Unimock::new((
        DiagnosticsMock::emit
            .next_call(matching!((text) if text.chars().count() == 65_536))
            .returns(()),
        DiagnosticsMock::emit
            .next_call(matching!((text) if text.chars().count() == 4096))
            .returns(()),
    ));
    forward_diagnostics(&mut reader, &diagnostics);
}
