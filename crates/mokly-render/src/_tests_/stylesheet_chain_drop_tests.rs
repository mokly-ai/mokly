//! Releasing the last bounded-store owner must not use one stack frame per context entry.

use std::sync::Arc;
use std::thread;

use mokly_source_interface::read_evidence::ReadEvidence;

use crate::input_stamp::InputStamp;
use crate::stylesheet_record::ContextEvidence;

#[test]
fn finding_8_releasing_a_long_context_chain_uses_bounded_stack_space() {
    thread::Builder::new()
        .stack_size(128 * 1024)
        .spawn(|| {
            let mut chain = None;
            for _ in 0..20_000 {
                chain = Some(Arc::new(ContextEvidence {
                    digest: String::new(),
                    base: chain,
                    evidence: ReadEvidence::default(),
                    stamp: InputStamp::default(),
                    consistent: true,
                    bytes: size_of::<ContextEvidence>(),
                }));
            }
            let weak = Arc::downgrade(chain.as_ref().unwrap());
            {
                let _released = chain;
            }
            assert!(weak.upgrade().is_none());
        })
        .unwrap()
        .join()
        .unwrap();
}
