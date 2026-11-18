//! Host estimates use physical total minus used memory and reject invalid readings.

use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::host_memory::{
    HostMemory, HostProbeMock, MemoryEstimate, NoMemoryLimits, PhysicalMemory,
};

#[test]
fn estimates_physical_headroom_without_swap_and_rejects_invalid_readings() {
    for (total, used, expected) in [
        (8_000, 3_000, Some(5_000)),
        (8_000, 8_000, Some(0)),
        (0, 3_000, None),
        (8_000, 0, None),
        (8_000, 9_000, None),
    ] {
        let probe = Unimock::new(
            HostProbeMock::physical_memory
                .each_call(matching!())
                .returns(PhysicalMemory { total, used }),
        );
        let memory = MemoryEstimate::new(Arc::new(probe.clone()), Arc::new(NoMemoryLimits));
        assert_eq!(
            memory.headroom_bytes(),
            expected,
            "total={total} used={used}"
        );
    }
}
