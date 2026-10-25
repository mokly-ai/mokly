//! Model empty, live, zombie, disappearing, and unobservable groups.

use std::io;

use unimock::{MockFn, Unimock, matching};

use super::{MembersMock, stopped};

#[test]
fn a_single_live_member_cannot_be_mistaken_for_an_empty_group() {
    let members = Unimock::new((
        MembersMock::list
            .next_call(matching!(17, _))
            .answers(&|_, _, pids| {
                pids[0] = 18;
                Ok(1)
            }),
        MembersMock::live
            .next_call(matching!(17, 18))
            .returns(Ok(true)),
    ));
    assert!(!stopped(&members, 17));
}

#[test]
fn zombies_and_members_reaped_during_enumeration_count_as_stopped() {
    let members = Unimock::new((
        MembersMock::list
            .next_call(matching!(17, _))
            .answers(&|_, _, pids| {
                pids[..2].copy_from_slice(&[18, 19]);
                Ok(2)
            }),
        MembersMock::live
            .next_call(matching!(17, 18))
            .returns(Ok(false)),
        MembersMock::live
            .next_call(matching!(17, 19))
            .returns(Ok(false)),
    ));
    assert!(stopped(&members, 17));
}

#[test]
fn list_or_status_errors_do_not_hide_permission_failures() {
    let members = Unimock::new(
        MembersMock::list
            .next_call(matching!(17, _))
            .returns(Err(io::ErrorKind::PermissionDenied.into())),
    );
    assert!(!stopped(&members, 17));
    let members = Unimock::new((
        MembersMock::list
            .next_call(matching!(17, _))
            .answers(&|_, _, pids| {
                pids[0] = 18;
                Ok(1)
            }),
        MembersMock::live
            .next_call(matching!(17, 18))
            .returns(Err(io::ErrorKind::UnexpectedEof.into())),
    ));
    assert!(!stopped(&members, 17));
}

#[test]
fn full_buffers_are_resized_before_accepting_a_stopped_group() {
    let members = Unimock::new((
        MembersMock::list
            .next_call(matching!((17, pids) if pids.len() == 256))
            .returns(Ok(256)),
        MembersMock::list
            .next_call(matching!((17, pids) if pids.len() == 512))
            .returns(Ok(0)),
    ));
    assert!(stopped(&members, 17));
}
