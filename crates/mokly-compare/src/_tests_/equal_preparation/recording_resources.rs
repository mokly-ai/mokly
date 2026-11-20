//! Ordered memo expectations cover stylesheet sources and embedded HTML on both sides.

use std::sync::Arc;

use mokly_graph::closure::Closure;
use mokly_model::evidence::{EvidenceOwner, ResourceEvidence};
use mokly_model::review_affected::ReviewSide;
use unimock::{MockFn, Unimock, matching};

use crate::resource_memo::{MemoEqualMock, MemoFactMock, MemoReadMock, ResourceFact};

pub(super) fn closure(file: &str) -> Closure {
    Closure {
        files: [file.into()].into(),
        evidence: ["static/theme.css", "static/image.svg"]
            .map(|path| ResourceEvidence {
                path: path.into(),
                owner: EvidenceOwner::Entry,
            })
            .into(),
        ..Default::default()
    }
}

fn fact() -> ResourceFact {
    ResourceFact {
        unavailable: false,
        digest: Some("same".into()),
        imports: vec![],
        references: vec![],
    }
}

pub(super) fn memo() -> Unimock {
    Unimock::new((
        MemoFactMock
            .next_call(matching!(ReviewSide::Before, "static/theme.css"))
            .answers(&|_, _, _| Ok(fact())),
        MemoReadMock
            .next_call(matching!(ReviewSide::Before, "static/embedded.html"))
            .answers(&|_, _, _| Ok(Some(Arc::from(b"<p>Embedded</p>".as_slice())))),
        MemoFactMock
            .next_call(matching!(ReviewSide::After, "static/theme.css"))
            .answers(&|_, _, _| Ok(fact())),
        MemoReadMock
            .next_call(matching!(ReviewSide::After, "static/embedded.html"))
            .answers(&|_, _, _| Ok(Some(Arc::from(b"<p>Embedded</p>".as_slice())))),
        MemoEqualMock
            .next_call(matching!("static/image.svg", "static/image.svg", _))
            .returns(Ok(true)),
        MemoEqualMock
            .next_call(matching!("static/theme.css", "static/theme.css", _))
            .returns(Ok(true)),
    ))
}
