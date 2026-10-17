//! The native Git base provider retains trusted sidecar style ownership.

use std::path::PathBuf;

mod changes_support;
use changes_support::{base, run, write};

#[test]
fn native_base_owned_style_edits_change_only_the_owning_component() {
    let card = "import {defineComponent} from '@mokly/mokly';export const card=defineComponent({title:'Card',description:'',relatedDocs:[],element:'ui-card',props:{},propSchema:{type:'object',additionalProperties:false,properties:{}},render:()=> <><style>{'.card{color:red}'}</style><p className='card'>Card</p></>});";
    let root = base(&[
        ("specs/card.mockup.tsx", card),
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<ui-card></ui-card>",
        ),
    ]);
    let modules = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../node_modules");
    #[cfg(unix)]
    std::os::unix::fs::symlink(modules, root.path().join("node_modules")).unwrap();
    #[cfg(windows)]
    std::os::windows::fs::symlink_dir(modules, root.path().join("node_modules")).unwrap();
    write(
        root.path(),
        "specs/card.mockup.tsx",
        &card.replace("color:red", "color:blue"),
    );
    let output = run(root.path(), &["build", "--strict", "--sidecars", "1"]);
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(output.stderr.is_empty());
    assert!(String::from_utf8_lossy(&output.stdout).contains("Changes ready · 1 change"));
}
