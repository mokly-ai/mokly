//! A Node preload that counts real manager installs and rejects network access.

use std::fs;
use std::path::{Path, PathBuf};

use serde_json::json;

/// The files that the probe writes, and the `NODE_OPTIONS` that loads it.
pub(super) struct Probe {
    pub(super) calls: PathBuf,
    pub(super) output: PathBuf,
    pub(super) network: PathBuf,
    pub(super) node_options: String,
}

/// Write the probe for `root`. It allows only the local registry `port`, when given.
pub(super) fn instrument(root: &Path, port: Option<u16>) -> Probe {
    let preload = root.join(".context/manager-probe.cjs");
    let calls = root.join(".context/manager-calls.jsonl");
    let output = root.join(".context/manager-output.log");
    let network = root.join(".context/manager-network.log");
    for file in [&calls, &output, &network] {
        fs::write(file, "").unwrap();
    }
    let quoted = |path: &Path| json!(path.display().to_string()).to_string();
    let allowed = json!(port).to_string();
    let script = format!(
        r#"
const fs = require('node:fs');
const net = require('node:net');
const allowed = {allowed};
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {{
  const target = Array.isArray(args[0]) ? args[0][0] : typeof args[0] === 'object' && args[0] !== null ? args[0] : {{ port: args[0], host: args[1] }};
  if (allowed !== null && Number(target?.port) === allowed && ['127.0.0.1', 'localhost'].includes(target?.host)) return connect.apply(this, args);
  fs.appendFileSync({network}, 'attempted\n'); throw new Error('network is forbidden in this fixture');
}};
if (/[/\\](pnpm(?:\.(cjs|mjs))?|yarn\.js)$/.test(process.argv[1] ? fs.realpathSync(process.argv[1]) : '') && process.argv.includes('install')) {{
  fs.appendFileSync({calls}, JSON.stringify({{ args: process.argv.slice(2), cwd: process.cwd() }}) + '\n');
  for (const stream of [process.stdout, process.stderr]) {{
    const write = stream.write.bind(stream);
    stream.write = function (chunk, ...rest) {{ fs.appendFileSync({output}, chunk); return write(chunk, ...rest); }};
  }}
}}
"#,
        network = quoted(&network),
        calls = quoted(&calls),
        output = quoted(&output),
    );
    fs::write(&preload, script).unwrap();
    let inherited = std::env::var("NODE_OPTIONS").unwrap_or_default();
    Probe {
        node_options: format!("{inherited} --require={}", quoted(&preload)),
        calls,
        output,
        network,
    }
}

/// The text of a probe file.
pub(super) fn read(path: &Path) -> String {
    fs::read_to_string(path).unwrap()
}
