//! Finite ancestors reclaim file cache while unknown data denies extra capacity.

use std::collections::BTreeMap;
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::cgroup_memory::{CgroupMemory, MemoryFile, MemoryFilesMock};
use crate::host_memory::MemoryLimits;

fn files() -> BTreeMap<String, String> {
    BTreeMap::from(
        [
            ("/proc/self/cgroup", "0::/parent/leaf\n"),
            (
                "/proc/self/mountinfo",
                "1 0 0:1 / /cg rw - cgroup2 cgroup rw\n",
            ),
            ("/cg/cgroup.controllers", "cpu memory pids\n"),
            ("/cg/parent/memory.max", "max\n"),
            ("/cg/parent/memory.high", "max\n"),
            ("/cg/parent/leaf/memory.max", "max\n"),
            ("/cg/parent/leaf/memory.high", "max\n"),
        ]
        .map(|(path, value)| (path.into(), value.into())),
    )
}

fn estimate(data: BTreeMap<String, String>, host: u64) -> Option<u64> {
    let files = Unimock::new(
        MemoryFilesMock::read
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                data.get(path.to_str().unwrap())
                    .cloned()
                    .map_or(MemoryFile::Missing, MemoryFile::Text)
            })),
    )
    .no_verify_in_drop();
    CgroupMemory::new(Arc::new(files)).headroom_bytes(host)
}

#[test]
fn finite_ancestors_credit_cache_and_honor_high_when_current_exceeds_it() {
    let mut data = files();
    for (name, value) in [
        ("memory.max", "9000"),
        ("memory.high", "5000"),
        ("memory.current", "6000"),
        ("memory.stat", "anon 3000\ninactive_file 2000\n"),
    ] {
        data.insert(format!("/cg/parent/{name}"), value.into());
    }
    assert_eq!(estimate(data.clone(), 8000), Some(1000));
    assert_eq!(estimate(data.clone(), 700), Some(700));
    data.insert("/cg/parent/memory.stat".into(), "inactive_file 9000".into());
    assert_eq!(estimate(data, 8000), Some(5000));
}

#[test]
fn explicitly_unlimited_groups_and_absent_controllers_keep_host_headroom() {
    assert_eq!(estimate(files(), 8000), Some(8000));
    let mut data = files();
    data.insert("/cg/cgroup.controllers".into(), "cpu pids".into());
    assert_eq!(estimate(data, 8000), Some(8000));
    let mut data = files();
    data.insert("/proc/self/cgroup".into(), "1:cpu:/parent/leaf".into());
    assert_eq!(estimate(data, 8000), Some(8000));
}

#[test]
fn unavailable_or_invalid_applicable_limits_make_the_reading_unknown() {
    for missing in ["memory.max", "memory.high", "memory.current", "memory.stat"] {
        let mut data = files();
        data.insert("/cg/parent/memory.max".into(), "5000".into());
        data.insert("/cg/parent/memory.current".into(), "3000".into());
        data.insert("/cg/parent/memory.stat".into(), "inactive_file 1000".into());
        data.remove(&format!("/cg/parent/{missing}"));
        assert_eq!(estimate(data, 8000), None, "missing {missing}");
    }
    let mut data = files();
    data.insert("/cg/parent/memory.high".into(), "invalid".into());
    assert_eq!(estimate(data, 8000), None);
}

#[test]
fn v1_limits_credit_recursive_cache_and_ignore_nonhierarchical_ancestors() {
    let mut data: BTreeMap<String, String> = BTreeMap::from(
        [
            ("/proc/self/cgroup", "1:cpu:/\n2:memory:/parent/leaf"),
            (
                "/proc/self/mountinfo",
                "1 0 0:1 / /cg rw - cgroup memory rw,memory",
            ),
            ("/cg/memory.limit_in_bytes", "9223372036854771712"),
            ("/cg/parent/memory.limit_in_bytes", "5000"),
            ("/cg/parent/memory.use_hierarchy", "1"),
            ("/cg/parent/memory.usage_in_bytes", "6000"),
            (
                "/cg/parent/memory.stat",
                "total_inactive_file 2000\ninactive_file 50",
            ),
            ("/cg/parent/leaf/memory.limit_in_bytes", "9000"),
            ("/cg/parent/leaf/memory.usage_in_bytes", "2000"),
            ("/cg/parent/leaf/memory.stat", "inactive_file 500"),
        ]
        .map(|(path, value)| (path.into(), value.into())),
    );
    assert_eq!(estimate(data.clone(), 8000), Some(1000));
    data.insert("/cg/parent/memory.use_hierarchy".into(), "0".into());
    assert_eq!(estimate(data.clone(), 8000), Some(7500));
    data.remove("/cg/parent/memory.use_hierarchy");
    assert_eq!(estimate(data.clone(), 8000), None);
    data.insert(
        "/cg/parent/memory.limit_in_bytes".into(),
        "9223372036854771712".into(),
    );
    assert_eq!(estimate(data.clone(), 8000), Some(7500));
    data.insert(
        "/cg/parent/leaf/memory.stat".into(),
        "total_inactive_file invalid\ninactive_file 500".into(),
    );
    assert_eq!(estimate(data.clone(), 8000), None);
    data.remove("/cg/parent/leaf/memory.limit_in_bytes");
    assert_eq!(estimate(data, 8000), None);
}

#[test]
fn mounted_subtrees_resolve_membership_and_unreadable_roots_are_unknown() {
    let mut data = files();
    data.insert("/proc/self/cgroup".into(), "0::/slice/parent/leaf".into());
    data.insert(
        "/proc/self/mountinfo".into(),
        "1 0 0:1 /slice /cg rw - cgroup2 cgroup rw".into(),
    );
    data.insert("/cg/parent/memory.high".into(), "4000".into());
    data.insert("/cg/parent/memory.current".into(), "3000".into());
    data.insert("/cg/parent/memory.stat".into(), "inactive_file 500".into());
    assert_eq!(estimate(data, 8000), Some(1500));
    let files = Unimock::new(
        MemoryFilesMock::read
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let data = files();
                move |_, path| {
                    data.get(path.to_str().unwrap())
                        .cloned()
                        .map_or(MemoryFile::Unreadable, MemoryFile::Text)
                }
            })),
    );
    assert_eq!(
        CgroupMemory::new(Arc::new(files)).headroom_bytes(8000),
        None
    );
}
