//! PostCSS consumed bytes, opaque reads, and base witnesses guard the installed output.

use std::fs;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;

use mokly_test_support::files::{tree, write};
use mokly_test_support::git::git;
use mokly_test_support::process::Finished;
use mokly_test_support::publication;
use regex::Regex;
use serde_json::json;

use super::support::mokly;

const THEME_CONFIG: &str =
    r#"{"postcss":"postcss.mjs","stylesheets":[{"match":"**","stylesheets":["theme.css"]}]}"#;

fn build(root: &Path, args: &[&str]) -> Finished {
    let mut all = vec!["build"];
    all.extend_from_slice(args);
    mokly().command(root, &all, "plain").run()
}

fn changed(stderr: &str, file: &str) -> bool {
    Regex::new(&format!(
        r"\[mokly/export-invalid\] Inputs changed during the build:.*{}",
        regex::escape(file)
    ))
    .unwrap()
    .is_match(stderr)
}

const HOME: &str = "
import fs from 'node:fs';
import {definePage} from '@mokly/mokly';
export default definePage({title:'Home',description:'',relatedDocs:[],render(){
fs.writeFileSync('.context/rendered', 'yes');
return '<!doctype html><html><head><title>Home</title></head><body>Home</body></html>';
}});";

#[test]
fn postcss_consumed_bytes_reject_an_edit_before_capture_and_preserve_owned_output() {
    let root = publication::fixture(true, "sha1");
    let path = root.path().to_path_buf();
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    let edited = Arc::new(AtomicBool::new(false));
    let flag = Arc::clone(&edited);
    let tokens = path.join("tokens.txt");
    thread::spawn(move || {
        for stream in listener.incoming() {
            let mut stream = stream.unwrap();
            let mut byte = [0; 4];
            if stream.read(&mut byte).unwrap_or(0) > 0 {
                fs::write(&tokens, "blue").unwrap();
                flag.store(true, Ordering::SeqCst);
                let _ = stream.write_all(b"continue");
            }
        }
    });
    write(&path, "tokens.txt", "red");
    write(&path, "theme.css", "a { color: black }");
    write(&path, "mokly.config.json", THEME_CONFIG);
    write(&path, "specs/home.mockup.ts", HOME);
    write(
        &path,
        "postcss.mjs",
        format!(
            "
import fs from 'node:fs';
import net from 'node:net';
export default {{plugins:[{{postcssPlugin:'tokens',async Once(root,{{result}}){{
const value=fs.readFileSync('tokens.txt','utf8');
if(fs.existsSync('.context/edit')) await new Promise((resolve,reject)=>{{
const socket=net.connect({port},'127.0.0.1',()=>socket.write('read'));
socket.once('data',()=>resolve()); socket.once('error',reject);
}});
root.walkDecls('color', declaration => {{ declaration.value=value }});
result.messages.push({{type:'dependency',plugin:'tokens',file:'tokens.txt'}});
}}}}]}};"
        ),
    );
    let args = ["--no-changes", "--sidecars=1", "--out=.context/site"];
    let initial = build(&path, &args);
    assert_eq!(initial.code, Some(0), "{}", initial.stderr);
    let previous = tree(&path.join(".context/site"));
    fs::remove_file(path.join(".context/rendered")).unwrap();
    write(&path, ".context/edit", "yes");
    let result = build(&path, &args);
    assert!(edited.load(Ordering::SeqCst));
    assert_eq!(fs::read_to_string(path.join("tokens.txt")).unwrap(), "blue");
    assert_eq!(result.code, Some(1), "{}", result.stderr);
    assert!(changed(&result.stderr, "tokens.txt"), "{}", result.stderr);
    assert!(!path.join(".context/rendered").exists());
    assert!(tree(&path.join(".context/site")) == previous);
}

#[test]
fn opaque_postcss_reads_keep_their_late_baseline_and_still_detect_later_edits() {
    let root = publication::fixture(true, "sha1");
    let path = root.path();
    write(path, "tokens.txt", "red");
    write(path, "theme.css", "a { color: black }");
    write(path, "mokly.config.json", THEME_CONFIG);
    write(
        path,
        "postcss.mjs",
        "
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
export default {plugins:[{postcssPlugin:'opaque',Once(root,{result}){
const value=execFileSync(process.execPath,['-e',\"process.stdout.write(require('node:fs').readFileSync('tokens.txt'))\"],{encoding:'utf8'});
fs.writeFileSync('tokens.txt','blue');
root.walkDecls('color',declaration=>{declaration.value=value});
result.messages.push({type:'dependency',file:'tokens.txt'});
}}]};",
    );
    write(
        path,
        "specs/home.mockup.ts",
        "
import fs from 'node:fs';
import {definePage} from '@mokly/mokly';
export default definePage({title:'Home',description:'',relatedDocs:[],render(){
if(fs.existsSync('.context/edit'))fs.writeFileSync('tokens.txt','green');
return '<!doctype html><html><head><title>Home</title></head><body>Home</body></html>';
}});",
    );
    let args = ["--no-changes", "--sidecars=1", "--out=.context/site"];
    let first = build(path, &args);
    assert_eq!(first.code, Some(0), "{}", first.stderr);
    assert_eq!(fs::read_to_string(path.join("tokens.txt")).unwrap(), "blue");
    let previous = tree(&path.join(".context/site"));
    let red = Regex::new(r"color:\s*red").unwrap();
    assert!(previous.iter().any(|(name, bytes)| {
        name.ends_with("theme.css") && red.is_match(&String::from_utf8_lossy(bytes))
    }));
    write(path, ".context/edit", "yes");
    let next = build(path, &args);
    assert_eq!(next.code, Some(1), "{}", next.stderr);
    assert!(changed(&next.stderr, "tokens.txt"), "{}", next.stderr);
    assert!(tree(&path.join(".context/site")) == previous);
}

fn base_witness(reader: &str) {
    let root = publication::fixture(false, "sha1");
    let path = root.path();
    write(path, "tokens.txt", "red");
    write(path, "theme.css", "a { color: black }");
    write(path, "mokly.config.json", THEME_CONFIG);
    let read = if reader == "whole" {
        "const value=fs.readFileSync('tokens.txt','utf8');"
    } else {
        "const fd=fs.openSync('tokens.txt','r');const bytes=Buffer.alloc(3);fs.readSync(fd,bytes,0,3,0);fs.closeSync(fd);const value=bytes.toString();"
    };
    write(
        path,
        "postcss.mjs",
        format!(
            "
import fs from 'node:fs';
export default {{plugins:[{{postcssPlugin:'base',Once(root,{{result}}){{
if(!fs.existsSync('.git')) fs.writeFileSync('tokens.txt','blue');
{read}
root.walkDecls('color',declaration=>{{declaration.value=value}});
result.messages.push({{type:'dependency',file:'tokens.txt'}});
}}}}]}};"
        ),
    );
    git(path, &["add", "."]);
    git(path, &["commit", "-qm", "postcss fixture"]);
    let first = build(path, &["--no-changes", "--out=.context/site"]);
    assert_eq!(first.code, Some(0), "{}", first.stderr);
    let previous = tree(&path.join(".context/site"));
    write(
        path,
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<h1>New head</h1>",
    );
    let result = build(
        path,
        &["--base=HEAD", "--sidecars=1", "--out=.context/site"],
    );
    assert_eq!(fs::read_to_string(path.join("tokens.txt")).unwrap(), "red");
    assert_eq!(result.code, Some(1), "{}", result.stderr);
    assert!(changed(&result.stderr, "tokens.txt"), "{}", result.stderr);
    assert!(tree(&path.join(".context/site")) == previous);
}

#[test]
fn base_postcss_whole_witnesses_are_checked_against_pinned_git_bytes_without_using_head_baselines()
{
    base_witness("whole");
}

#[test]
fn base_postcss_range_witnesses_are_checked_against_pinned_git_bytes_without_using_head_baselines()
{
    base_witness("range");
}

#[test]
fn base_postcss_package_witnesses_reject_changes_before_document_callbacks() {
    let root = publication::fixture(true, "sha1");
    let path = root.path();
    let marker = path.join(".context/base-callback");
    write(path, ".deps/package.json", "{}");
    let plugin = path.join(".deps/node_modules/probe");
    write(
        &plugin,
        "package.json",
        json!({ "name": "probe", "main": "index.mjs" }).to_string(),
    );
    write(
        &plugin,
        "index.mjs",
        "
import fs from 'node:fs';
import value from './value.mjs';
export default ()=>({postcssPlugin:'probe',Once(root){
if(process.env.MOKLY_TEST_POSTCSS_BASE_EDIT && !fs.existsSync('.git'))
  fs.writeFileSync(new URL('./value.mjs',import.meta.url),\"export default 'blue';\");
root.walkDecls('color',declaration=>{declaration.value=value});
}});",
    );
    write(&plugin, "value.mjs", "export default 'red';");
    write(path, "theme.css", "a { color: black }");
    write(path, "postcss.mjs", "export default {plugins:{probe:{}}};");
    write(
        path,
        "mokly.config.json",
        json!({
            "postcss": "postcss.mjs",
            "stylesheets": [{ "match": "**", "stylesheets": ["theme.css"] }],
            "moduleResolution": { "packageRoots": [".deps"] },
        })
        .to_string(),
    );
    write(
        path,
        "specs/home.mockup.ts",
        format!(
            "
import fs from 'node:fs';
import {{definePage}} from '@mokly/mokly';
export default definePage({{title:'Home',description:'',relatedDocs:[],render(){{
if(!fs.existsSync('.git')) fs.writeFileSync({},'ran');
return '<!doctype html><html><head><title>Home</title></head><body>Home</body></html>';
}}}});",
            json!(marker.display().to_string())
        ),
    );
    fs::create_dir_all(marker.parent().unwrap()).unwrap();
    git(path, &["add", "."]);
    git(path, &["commit", "-qm", "base package witness"]);
    let args = ["--base=HEAD", "--sidecars=1", "--out=.context/site"];
    let stable = build(path, &args);
    assert_eq!(stable.code, Some(0), "{}", stable.stderr);
    assert_eq!(fs::read_to_string(&marker).unwrap(), "ran");
    fs::remove_file(&marker).unwrap();
    let previous = tree(&path.join(".context/site"));
    let mut all = vec!["build"];
    all.extend_from_slice(&args);
    let result = mokly()
        .command(path, &all, "plain")
        .env("MOKLY_TEST_POSTCSS_BASE_EDIT", "1")
        .run();
    assert_eq!(result.code, Some(1), "{}", result.stderr);
    assert!(changed(&result.stderr, "value.mjs"), "{}", result.stderr);
    assert_eq!(
        fs::read_to_string(plugin.join("value.mjs")).unwrap(),
        "export default 'blue';"
    );
    assert!(tree(&path.join(".context/site")) == previous);
    assert!(!marker.exists());
}
