//! A local npm registry for one package that serves only requests with its bearer token.

use std::sync::{Arc, Mutex};

use mokly_test_support::npm;
use mokly_test_support::server::{Response, Server};
use serde_json::{Value, json};

/// One registry request, with its raw authorization header.
#[derive(Clone, Debug)]
pub(super) struct RegistryRequest {
    pub(super) path: String,
    pub(super) authorized: bool,
    pub(super) authorization: Option<String>,
}

/// A running registry and the requests that it recorded.
pub(super) struct Registry {
    _server: Server,
    pub(super) url: String,
    pub(super) port: u16,
    pub(super) requests: Arc<Mutex<Vec<RegistryRequest>>>,
}

impl Registry {
    /// Serve `versions` of `name` to requests with `token`.
    pub(super) fn start(name: &str, versions: Vec<(&str, Vec<u8>)>, token: &str) -> Self {
        let versions: Vec<Published> = versions
            .into_iter()
            .map(|(version, tarball)| Published {
                version: version.to_owned(),
                shasum: npm::sha1(&tarball),
                integrity: npm::integrity(&tarball),
                tarball,
            })
            .collect();
        let requests = Arc::new(Mutex::new(Vec::new()));
        let recorded = Arc::clone(&requests);
        let origin = Arc::new(Mutex::new(String::new()));
        let base = Arc::clone(&origin);
        let name = name.to_owned();
        let expected = format!("Bearer {token}");
        let server = Server::concurrent(Arc::new(move |request| {
            let path = request.target.split('?').next().unwrap().to_owned();
            let authorization = request.headers.get("authorization").cloned();
            let authorized = authorization.as_deref() == Some(expected.as_str());
            recorded.lock().unwrap().push(RegistryRequest {
                path: path.clone(),
                authorized,
                authorization,
            });
            let tarball = versions
                .iter()
                .find(|published| path == format!("/{name}/-/{name}-{}.tgz", published.version));
            if !authorized {
                Response::empty(401, &[])
            } else if let Some(published) = tarball {
                Response {
                    status: 200,
                    declared_length: None,
                    content_type: Some("application/octet-stream".to_owned()),
                    body: published.tarball.clone(),
                    headers: Vec::new(),
                }
            } else if decode(&path) == format!("/{name}") {
                let body = packument(&base.lock().unwrap(), &name, &versions);
                Response::json(200, body.to_string().into_bytes())
            } else {
                Response::empty(404, &[])
            }
        }));
        let url = server.origin.clone();
        origin.lock().unwrap().clone_from(&url);
        let port = url.rsplit(':').next().unwrap().parse().unwrap();
        Self {
            _server: server,
            url,
            port,
            requests,
        }
    }

    /// A copy of the recorded requests.
    pub(super) fn requests(&self) -> Vec<RegistryRequest> {
        self.requests.lock().unwrap().clone()
    }
}

fn decode(path: &str) -> String {
    path.replace("%40", "@")
        .replace("%2F", "/")
        .replace("%2f", "/")
}

/// One published version with its archive and digests.
struct Published {
    version: String,
    tarball: Vec<u8>,
    shasum: String,
    integrity: String,
}

fn packument(url: &str, name: &str, versions: &[Published]) -> Value {
    let published = "2020-01-01T00:00:00.000Z";
    let mut time = json!({ "created": published, "modified": published });
    let mut entries = json!({});
    for entry in versions {
        let version = entry.version.as_str();
        time[version] = json!(published);
        entries[version] = json!({
            "name": name,
            "version": version,
            "main": "index.js",
            "dist": {
                "tarball": format!("{url}/{name}/-/{name}-{version}.tgz"),
                "shasum": entry.shasum,
                "integrity": entry.integrity,
            },
        });
    }
    json!({
        "name": name,
        "dist-tags": { "latest": versions.last().map(|entry| entry.version.clone()) },
        "time": time,
        "versions": entries,
    })
}
