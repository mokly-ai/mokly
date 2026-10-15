//! One referenced-asset walk for build, Serve, and either comparison side.

use std::collections::{BTreeMap, BTreeSet, VecDeque};
use std::sync::Arc;

use mokly_html::tree::Node;
use mokly_model::evidence::{EvidenceOwner, ResourceEvidence};
use mokly_source_interface::tree::SourceTree;

use crate::closure_prefetch;
use crate::error;
use crate::error::{Result, invalid};
use crate::policy::PublicPolicy;
use crate::public_denial::PublicDenial;
use crate::reference_index::ReferenceIndex;
use crate::references::{ResourceReference, collect};
use crate::resource_reach::ResourceReach;
use crate::urls::local_target;

/// Generation-owned resources are read from plans and cache, never by disk route.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = GeneratedResourcesMock))]
pub trait GeneratedResources: Send + Sync {
    /// Obtain pending stylesheet or asset bytes; documents are not followed.
    fn resource(&self, route: &str) -> Result<Option<Vec<u8>>>;
    /// Test whether a route is a declared catalogue document.
    fn is_document(&self, route: &str) -> bool;
}

/// Sorted authored closure with traversal and ownership evidence.
#[derive(Clone, Debug, Default)]
pub struct Closure {
    /// Repository-relative authored files, never generated route names.
    pub files: BTreeSet<String>,
    /// Per-file reference lists reused by watch.
    pub edges: BTreeMap<String, Vec<String>>,
    /// Every resource reached by an entry or component owner.
    pub evidence: Vec<ResourceEvidence>,
    /// Exact instance and referring edge for comparison-only implementation proof.
    pub references: Vec<ResourceReach>,
}

/// Injected closure traversal boundary.
pub trait ClosureBuilder: Send + Sync {
    /// Follow one composed document and its renderer-declared seeds.
    fn collect(&self, route: &str, tree: &[Node], seeds: &[String]) -> Result<Closure>;
}

/// Reuses one generation's public policy for every target.
pub struct Walker {
    /// Authored bytes from a working or Git tree.
    pub tree: Arc<dyn SourceTree>,
    /// Cached eligibility decisions for this generation.
    pub policy: Arc<dyn PublicPolicy>,
    /// Pending generated resources and document routes.
    pub generated: Arc<dyn GeneratedResources>,
    /// One reference-edge cache for this generation.
    pub index: Arc<dyn ReferenceIndex>,
}

impl ClosureBuilder for Walker {
    fn collect(&self, route: &str, tree: &[Node], seeds: &[String]) -> Result<Closure> {
        let mut result = Closure::default();
        let source = format!("static/mokly-generated/{route}");
        let mut queue: VecDeque<_> = collect(tree)
            .into_iter()
            .map(|reference| (source.clone(), reference))
            .collect();
        for seed in seeds {
            queue.push_back((
                "static/index.html".into(),
                ResourceReference {
                    url: seed.clone(),
                    owner: EvidenceOwner::Entry,
                    ignored: false,
                    instance_key: None,
                },
            ));
        }
        closure_prefetch::prefetch(self, &source, &collect(tree))?;
        let mut edges: BTreeMap<String, Vec<String>> = BTreeMap::new();
        let mut visited = BTreeSet::new();
        let mut evidence = BTreeMap::new();
        while let Some((source, reference)) = queue.pop_front() {
            let target = match local_target(&source, &reference.url) {
                Ok(target) => target,
                Err(source) => {
                    return Err(invalid(
                        route,
                        format!(
                            "{route}: invalid resource URL {:?}: {}",
                            reference.url,
                            source.reason()
                        ),
                    ));
                }
            };
            let Some(target) = target else {
                continue;
            };
            if let Some(generated) = target.strip_prefix("static/mokly-generated/")
                && self.generated.is_document(generated)
            {
                continue;
            }
            let owner_key = match &reference.owner {
                EvidenceOwner::Entry => String::new(),
                EvidenceOwner::Component { path } => path.clone(),
            };
            if !reference.ignored {
                evidence.insert((target.clone(), owner_key.clone()), reference.owner.clone());
                result.references.push(ResourceReach {
                    path: target.clone(),
                    owner: reference.owner.clone(),
                    instance_key: reference.instance_key.clone(),
                    source: source.clone(),
                    url: reference.url.clone(),
                });
            }
            if !visited.insert((
                target.clone(),
                owner_key,
                reference.instance_key.clone(),
                reference.ignored,
            )) {
                continue;
            }
            let urls = if let Some(cached) = edges.get(&target) {
                cached.clone()
            } else {
                let bytes: Arc<[u8]> = if let Some(generated) =
                    target.strip_prefix("static/mokly-generated/")
                {
                    if let Some(urls) = self.index.get(&target) {
                        edges.insert(target.clone(), urls.clone());
                        for url in urls {
                            queue.push_back((
                                target.clone(),
                                ResourceReference {
                                    url,
                                    owner: reference.owner.clone(),
                                    ignored: reference.ignored,
                                    instance_key: reference.instance_key.clone(),
                                },
                            ));
                        }
                        continue;
                    }
                    self.generated
                        .resource(generated)?
                        .ok_or_else(|| missing(route, &reference.url))?
                        .into()
                } else {
                    let path = target
                        .strip_prefix("static/")
                        .ok_or_else(|| missing(route, &reference.url))?;
                    let file = match self.policy.check(path) {
                        Ok(file) => file,
                        Err(PublicDenial::Missing) => return Err(missing(route, &reference.url)),
                        Err(reason) => {
                            return Err(invalid(
                                route,
                                format!(
                                    "document links and resources are invalid:\n- {route}: protected target {}: {}",
                                    reference.url,
                                    reason.reason()
                                ),
                            ));
                        }
                    };
                    result.files.insert(path.into());
                    if let Some(urls) = self.index.get(&target) {
                        edges.insert(target.clone(), urls.clone());
                        for url in urls {
                            queue.push_back((
                                target.clone(),
                                ResourceReference {
                                    url,
                                    owner: reference.owner.clone(),
                                    ignored: reference.ignored,
                                    instance_key: reference.instance_key.clone(),
                                },
                            ));
                        }
                        continue;
                    }
                    if !target.ends_with(".css")
                        && !target.ends_with(".html")
                        && !target.ends_with(".htm")
                    {
                        if self.tree.public_digest(&file.absolute).is_err() {
                            return Err(missing(route, &reference.url));
                        }
                        self.index.parse(&target, &[])?;
                        edges.insert(target.clone(), Vec::new());
                        continue;
                    }
                    match self.tree.read_public(&file.absolute) {
                        Ok(bytes) => bytes.into(),
                        Err(_) => return Err(missing(route, &reference.url)),
                    }
                };
                let urls = self.index.parse(&target, &bytes)?;
                closure_prefetch::urls(self, &target, &urls)?;
                edges.insert(target.clone(), urls.clone());
                urls
            };
            for url in urls {
                queue.push_back((
                    target.clone(),
                    ResourceReference {
                        url,
                        owner: reference.owner.clone(),
                        ignored: reference.ignored,
                        instance_key: reference.instance_key.clone(),
                    },
                ));
            }
        }
        result.edges = edges;
        result.evidence = evidence
            .into_iter()
            .map(|((path, _), owner)| ResourceEvidence { path, owner })
            .collect();
        Ok(result)
    }
}

fn missing(route: &str, reference: &str) -> error::GraphError {
    invalid(
        route,
        format!("document links and resources are invalid:\n- {route}: missing target {reference}"),
    )
}
