//! Only base capture and early renders leave the shared foreground render workers.

use std::sync::Arc;

use mokly_cli::capture_workers::{CaptureCapacity, CaptureWorkers};
use mokly_graph::error::Result;
use mokly_graph::workers::{RenderWorkers, ThreadWorkers};

use crate::serve_pool::PoolScheduling;

struct Capacity {
    sidecars: Arc<dyn PoolScheduling>,
}

impl CaptureCapacity for Capacity {
    fn capacity(&self) -> usize {
        self.sidecars.limit()
    }
}

pub(super) fn workers(
    inner: Arc<dyn RenderWorkers>,
    sidecars: Arc<dyn PoolScheduling>,
) -> Result<Arc<dyn RenderWorkers>> {
    let capture = Arc::new(ThreadWorkers::new(
        inner.comparison_parallelism().min(sidecars.limit()).max(1),
    )?);
    Ok(Arc::new(CaptureWorkers {
        inner,
        capture,
        capacity: Arc::new(Capacity { sidecars }),
    }))
}
