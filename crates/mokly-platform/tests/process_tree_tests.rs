//! Process ownership across Unix sessions, with helper re-exec and cleanup.

#[cfg(unix)]
mod process_tree;

#[cfg(unix)]
mod unix {
    //! Each test observes live helpers before it requests a tree stop.

    use crate::process_tree::fixture::Tree;
    use crate::process_tree::unix_helpers::run_helper;
    #[cfg(target_os = "linux")]
    use crate::process_tree::unix_status::parent;
    use crate::process_tree::unix_status::{alive, wait_gone};

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
