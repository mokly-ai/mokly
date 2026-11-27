//! Restored bundle replies cross the real client boundary with scripted transports.

mod decoding_tests;
mod lifecycle_tests;
mod ownership_tests;
mod reconstruction_tests;

use std::collections::VecDeque;
use std::sync::{Arc, Mutex};

use serde_json::json;
use serde_json::value::to_raw_value;
use unimock::{MockFn, Unimock, matching};

use crate::client::{Client, SidecarClient, TransportMock};
use crate::compiled::{PhysicalInput, RestoreGeneration};
use crate::compiled_fixture::compiled;
use crate::error::{Error, ProtocolError, Result};
use crate::methods::{Bundle, BundleRequest, Call};
use crate::results;
use crate::wire::{Frame, MethodResult, Request, Response};

struct Script {
    client: Client,
    frames: Arc<Mutex<VecDeque<Result<Frame>>>>,
    sent: Arc<Mutex<usize>>,
}

impl Script {
    fn new(frames: Vec<Result<Frame>>) -> Self {
        let mut frames = VecDeque::from(frames);
        frames.push_front(reply(0, json!({"version": "fixture"})));
        let frames = Arc::new(Mutex::new(frames));
        let received = frames.clone();
        let sent = Arc::new(Mutex::new(0));
        let requests = sent.clone();
        let mock = Unimock::new((
            TransportMock::send
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    *requests.lock().unwrap() += 1;
                    Ok(())
                })),
            TransportMock::receive
                .each_call(matching!())
                .answers_arc(Arc::new(move |_| {
                    received
                        .lock()
                        .unwrap()
                        .pop_front()
                        .unwrap_or(Err(Error::Crashed))
                })),
        ));
        let mut client = Client::new(Box::new(mock.clone()), Box::new(mock), "fixture".into());
        client.handshake().unwrap();
        Self {
            client,
            frames,
            sent,
        }
    }

    fn finished(&self, requests: usize) {
        assert_eq!(*self.sent.lock().unwrap(), requests + 1);
        assert_eq!(self.frames.lock().unwrap().len(), 0);
    }
}

fn params() -> Bundle {
    Bundle {
        evaluation: Some("new-evaluation".into()),
        entry_files: vec!["entry.ts".into()],
        renderer: None,
        stories_files: vec![],
        instance_name_props: None,
        source_root: "/repo".into(),
        configuration_directory: ".".into(),
        repository_roots: vec![],
        module_resolution: Default::default(),
        vite: false,
        vite_inputs: None,
    }
}

fn request(id: u64, call: Call) -> Request {
    Request {
        id,
        call,
        quiet: false,
    }
}

fn bundle(id: u64) -> Request {
    request(
        id,
        Call::Bundle(BundleRequest {
            params: params(),
            capture: None,
            plan: None,
            preparation: None,
        }),
    )
}

fn restore(id: u64, generation: &str, identity: &str) -> Request {
    let mut recipe = compiled(identity);
    recipe.runtime_key = format!("runtime:{identity}");
    recipe.code = format!("module.exports={{value:{identity:?}}}");
    recipe.metadata_identity = Some(format!("metadata:{identity}"));
    recipe.dependency_roots = vec!["/dependencies".into()];
    recipe.css_modules = vec!["theme.module.css".into()];
    recipe
        .sources
        .insert("entry.ts".into(), "export const value='source';".into());
    recipe
        .peers
        .insert("react".into(), Some("/dependencies/react/index.js".into()));
    recipe
        .inputs
        .insert("/repo/entry.ts".into(), Some("entry-digest".into()));
    recipe
        .metadata_inputs
        .insert("entry.ts".into(), Some("entry-digest".into()));
    recipe
        .input_directories
        .insert("/repo".into(), vec!["entry.ts".into()]);
    recipe
        .metadata_directories
        .insert(".".into(), vec!["entry.ts".into()]);
    recipe.unmapped_dependency_directories = Some(vec!["packages/unmapped".into()]);
    Arc::make_mut(&mut recipe.reuse_evidence).inputs.insert(
        "/repo/entry.ts".into(),
        PhysicalInput::File {
            digest: "entry-digest".into(),
        },
    );
    request(
        id,
        Call::RestoreGeneration(Box::new(RestoreGeneration {
            generation: generation.into(),
            params: params(),
            compiled: Arc::new(recipe),
            modules: vec![
                results::Module {
                    package_import: None,
                    digest: Some(format!("digest:{identity}")),
                    path: "entry.ts".into(),
                    imports: vec!["theme.module.css".into(), "shared.ts".into()],
                    imported_asset: None,
                },
                results::Module {
                    package_import: None,
                    digest: Some("shared-digest".into()),
                    path: "shared.ts".into(),
                    imports: vec![],
                    imported_asset: None,
                },
            ]
            .into(),
        })),
    )
}

fn restored(request: &Request) -> &RestoreGeneration {
    let Call::RestoreGeneration(value) = &request.call else {
        panic!("expected restore request")
    };
    value
}

fn reply(id: u64, value: serde_json::Value) -> Result<Frame> {
    Ok(Frame::Response(Response::Success {
        id,
        result: to_raw_value(&value).unwrap(),
    }))
}

fn short(id: u64, generation: &str, origin: &str) -> Result<Frame> {
    reply(
        id,
        json!({"generation": generation, "restoredGeneration": origin}),
    )
}

fn full(id: u64, generation: &str, source: &Request) -> Result<Frame> {
    let source = restored(source);
    reply(
        id,
        json!({
            "generation": generation,
            "compiled": source.compiled,
            "modules": source.modules,
            "unmappedDependencyDirectories": source.compiled.unmapped_dependency_directories.clone().unwrap_or_default(),
        }),
    )
}

fn accepted(result: Result<MethodResult>) -> results::Bundle {
    assert!(
        matches!(&result, Ok(MethodResult::Bundle(_))),
        "short reply must reconstruct: {result:?}"
    );
    result.unwrap().into_bundle()
}

fn exact(result: &results::Bundle, source: &Request, generation: &str) {
    let source = restored(source);
    assert_eq!(result.generation, generation);
    assert_eq!(
        serde_json::to_value(&result.compiled).unwrap(),
        serde_json::to_value(&source.compiled).unwrap()
    );
    assert_eq!(
        serde_json::to_value(&result.modules).unwrap(),
        serde_json::to_value(&source.modules).unwrap()
    );
    assert!(Arc::ptr_eq(&result.compiled, &source.compiled));
    assert_eq!(result.modules.as_ptr(), source.modules.as_ptr());
    assert_eq!(
        result.unmapped_dependency_directories,
        Some(
            source
                .compiled
                .unmapped_dependency_directories
                .clone()
                .unwrap_or_default()
        )
    );
    assert_eq!(result.plan, None);
    assert_eq!(result.epoch, 0);
    assert_eq!(result.cache, None);
    assert_eq!(result.compile_count, 0);
}

fn protocol_error(result: Result<MethodResult>) {
    assert!(
        matches!(result, Err(Error::Protocol(ProtocolError::Json { .. }))),
        "expected malformed result protocol error: {result:?}"
    );
}
