//! Process ownership across Unix sessions, with helper re-exec and cleanup.

#[cfg(unix)]
mod process_tree;

#[cfg(unix)]
mod unix {
    //! Unix ownership checks for live descendants and exited, unreaped roots.

    use std::mem::MaybeUninit;
    use std::process::Command;

    use mokly_platform::processes::{ProcessGroups, SystemProcessGroups};

    use crate::process_tree::fixture::Tree;
    use crate::process_tree::unix_helpers::run_helper;
    #[cfg(target_os = "linux")]
    use crate::process_tree::unix_status::parent;
    use crate::process_tree::unix_status::{alive, wait_gone};

    /// An unreaped child keeps its identity even after it has stopped running.
    #[test]
    fn attachment_and_stops_succeed_after_the_child_exits_before_reaping() {
        let mut command = Command::new("sh");
        command.args(["-c", "exit 23"]);
        SystemProcessGroups.configure(&mut command).unwrap();
        let mut child = command.spawn().unwrap();
        let mut info = MaybeUninit::<libc::siginfo_t>::uninit();
        // SAFETY: This PID is our unreaped child. The aligned buffer has the
        // exact siginfo_t size. WNOWAIT observes exit without reaping the child.
        let waited = unsafe {
            libc::waitid(
                libc::P_PID,
                child.id(),
                info.as_mut_ptr(),
                libc::WEXITED | libc::WNOWAIT,
            )
        };
        let wait_error = std::io::Error::last_os_error();
        let group = SystemProcessGroups.attach(&child);
        let terminated = group.as_ref().map(|group| group.terminate());
        let killed = group.as_ref().map(|group| group.kill());
        let was_alive = alive(i32::try_from(child.id()).unwrap());
        let status = child.wait().unwrap();
        assert_eq!(waited, 0, "waitid failed: {wait_error}");
        assert!(
            group.is_ok(),
            "attachment failed: {:?}",
            group.as_ref().err()
        );
        assert!(
            matches!(terminated, Ok(Ok(()))),
            "terminate failed: {terminated:?}"
        );
        assert!(matches!(killed, Ok(Ok(()))), "kill failed: {killed:?}");
        assert!(!was_alive, "an exited, unreaped child is not alive");
        assert_eq!(status.code(), Some(23));
    }

    #[test]
    fn kill_stops_a_descendant_in_a_new_session() {
        let mut tree = Tree::start("kill");
        assert!(tree.pids.iter().all(|pid| alive(*pid)));
        tree.group.kill().unwrap();
        tree.child.wait().unwrap();
        for &pid in &tree.pids {
            wait_gone(pid);
        }
    }

    #[test]
    fn terminate_then_kill_stops_an_ignoring_new_session_tree() {
        let mut tree = Tree::start("ignore");
        assert!(tree.pids.iter().all(|pid| alive(*pid)));
        tree.group.terminate().unwrap();
        tree.child.wait().unwrap();
        assert!(tree.pids.iter().all(|pid| alive(*pid)));
        tree.group.kill().unwrap();
        for &pid in &tree.pids {
            wait_gone(pid);
        }
    }

    #[test]
    fn kill_keeps_a_child_whose_intermediate_parent_dies_after_terminate() {
        let mut tree = Tree::start("parent-exits");
        assert!(tree.pids.iter().all(|pid| alive(*pid)));
        tree.group.terminate().unwrap();
        tree.child.wait().unwrap();
        wait_gone(tree.pids[0]);
        assert!(alive(tree.pids[1]));
        tree.group.kill().unwrap();
        wait_gone(tree.pids[1]);
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn kill_stops_an_orphan_adopted_by_the_owned_subreaper() {
        let mut tree = Tree::start("orphan");
        wait_gone(tree.pids[0]);
        assert!(alive(tree.pids[1]));
        assert_eq!(parent(tree.pids[1]), tree.child.id() as i32);
        tree.group.kill().unwrap();
        tree.child.wait().unwrap();
        wait_gone(tree.pids[1]);
    }

    #[test]
    fn new_session_helper() {
        run_helper();
    }
}
