//! npm package archives, the digests that lockfiles and registries use, and the npm CLI.

use std::io::Write;
use std::path::Path;
use std::process::{Command, Output, Stdio};

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use flate2::Compression;
use flate2::write::GzEncoder;
use sha2::{Digest, Sha512};

/// A gzip-compressed tar archive of `files` below the folder `package/`.
///
/// Every entry has mode `0644`, owner zero, and modification time zero.
pub fn archive(files: &[(&str, &str)]) -> Vec<u8> {
    let mut builder = tar::Builder::new(GzEncoder::new(Vec::new(), Compression::default()));
    for (name, text) in files {
        let mut header = tar::Header::new_ustar();
        header.set_size(text.len() as u64);
        header.set_mode(0o644);
        header.set_mtime(0);
        header.set_uid(0);
        header.set_gid(0);
        header.set_entry_type(tar::EntryType::Regular);
        builder
            .append_data(&mut header, format!("package/{name}"), text.as_bytes())
            .unwrap();
    }
    builder.into_inner().unwrap().finish().unwrap()
}

/// The npm `sha512-` integrity value of `bytes`.
pub fn integrity(bytes: &[u8]) -> String {
    format!("sha512-{}", STANDARD.encode(Sha512::digest(bytes)))
}

/// The SHA-1 hexadecimal digest of `bytes`, computed by Node's `crypto`.
pub fn sha1(bytes: &[u8]) -> String {
    let script = "const c=require('node:crypto');const d=[];process.stdin.on('data',x=>d.push(x)).on('end',()=>process.stdout.write(c.createHash('sha1').update(Buffer.concat(d)).digest('hex')))";
    let mut child = Command::new("node")
        .args(["-e", script])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .expect("node starts");
    child.stdin.take().unwrap().write_all(bytes).unwrap();
    let output = child.wait_with_output().unwrap();
    assert!(output.status.success());
    String::from_utf8(output.stdout).unwrap()
}

/// Run npm with `args` in `root` and the environment overrides `env`.
///
/// Panics with npm's output when it fails.
pub fn run(root: &Path, args: &[&str], env: &[(String, String)]) -> Output {
    let output = Command::new("npm")
        .current_dir(root)
        .args(args)
        .envs(env.iter().map(|(name, value)| (name, value)))
        .output()
        .expect("npm starts");
    assert!(
        output.status.success(),
        "npm {}: {}",
        args.join(" "),
        String::from_utf8_lossy(&output.stderr)
    );
    output
}
