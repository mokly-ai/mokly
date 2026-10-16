//! Isolated sidecar instrumentation and a real terminal for manual rebuild tests.

use std::fs::{self, File};
use std::os::fd::FromRawFd;
use std::path::{Path, PathBuf};

pub(super) fn terminal(root: &Path, workspace: &Path) -> (PathBuf, File, File) {
    let package = root.join(".fixture-sidecar");
    fs::create_dir_all(package.join("dist")).unwrap();
    fs::copy(
        workspace.join("packages/mokly/package.json"),
        package.join("package.json"),
    )
    .unwrap();
    let target = workspace.join("packages/mokly/dist/sidecar.js");
    fs::write(package.join("dist/sidecar.js"), format!(
            "const write=process.stdout.write.bind(process.stdout); process.stdout.write=(chunk,...args)=>{{try{{const value=JSON.parse(String(chunk)); if(value.event==='operation'&&value.params.operation==='esbuild') process.stderr.write('fixture-esbuild\\n');}}catch{{}} return write(chunk,...args);}}; await import({});",
            serde_json::to_string(&format!("file://{}", target.display())).unwrap()
        )).unwrap();
    let mut master = -1;
    let mut slave = -1;
    // SAFETY: openpty initializes two descriptor slots; null options select defaults.
    assert_eq!(
        unsafe {
            libc::openpty(
                &mut master,
                &mut slave,
                std::ptr::null_mut(),
                std::ptr::null(),
                std::ptr::null(),
            )
        },
        0
    );
    // SAFETY: successful openpty creates two distinct owned descriptors.
    let (input, slave) = unsafe { (File::from_raw_fd(master), File::from_raw_fd(slave)) };
    (package, input, slave)
}
