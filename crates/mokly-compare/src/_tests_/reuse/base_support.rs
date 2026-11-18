//! A real checking reader surrounds the generation used by comparison tests.

use std::sync::Arc;

use mokly_git::control::CancellationMock;
use mokly_graph::types::RenderGeneration;
use unimock::{MockFn, Unimock, matching};

use crate::base_reader::BaseReader;
use crate::base_retention::{BaseReuse, KeptBase};

pub(super) fn reader(generation: Arc<dyn RenderGeneration>) -> Arc<dyn RenderGeneration> {
    Arc::new(BaseReader::new(BaseReuse {
        base: Arc::new(KeptBase {
            generation,
            failures: Arc::new(Unimock::new(())),
            scripts_off: false,
            freshness: None,
        }),
        cancellation: Arc::new(Unimock::new(
            CancellationMock::cancelled
                .each_call(matching!())
                .returns(false),
        )),
        releaser: Arc::new(Unimock::new(())),
    }))
}
