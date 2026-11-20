//! Rebuild embedded migration metadata when forward migrations are added.

fn main() {
    println!("cargo:rerun-if-changed=migrations");
}
