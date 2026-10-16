//! Back-off survives replacement and resets only after memory is below the bound.

use crate::memory_schedule::{MEMORY_LIMIT, MemorySchedule};

#[test]
fn sixty_four_high_requests_recycle_logarithmically_and_report_once() {
    let mut schedule = MemorySchedule::default();
    let mut requests = 0;
    let mut recycled_at = Vec::new();
    let mut notices = 0;
    for completed in 1..=64 {
        requests += 1;
        if schedule.due(requests)
            && let Some(warn) = schedule.sample(requests, MEMORY_LIMIT + 1)
        {
            recycled_at.push(completed);
            notices += usize::from(warn);
            requests = 0;
            schedule.started();
        }
    }
    assert_eq!(recycled_at, [2, 6, 14, 30, 62]);
    assert_eq!(notices, 1);
}

#[test]
fn low_memory_resets_the_delay_and_the_notice_and_the_delay_caps_at_500() {
    let mut schedule = MemorySchedule::default();
    for delay in [2, 4, 8, 16, 32, 64, 128, 256, 500] {
        assert!(schedule.due(delay));
        assert!(schedule.sample(delay, MEMORY_LIMIT + 1).is_some());
        schedule.started();
    }
    assert!(!schedule.due(499));
    assert!(schedule.due(500));
    assert!(schedule.sample(500, MEMORY_LIMIT).is_none());
    assert!(schedule.due(501));
    assert_eq!(schedule.sample(501, MEMORY_LIMIT + 1), Some(false));
    schedule.started();
    assert!(!schedule.due(3));
    assert!(schedule.due(4));
    assert_eq!(schedule.sample(4, MEMORY_LIMIT + 1), Some(true));
}
