//! Record proof inputs at the complete resource walk's read boundaries.

use std::collections::{BTreeMap, BTreeSet, VecDeque};

use mokly_html::tree::Node;
use mokly_model::evidence::{EvidenceOwner, ResourceEvidence};
use mokly_model::namespace;

use crate::closure::{Closure, Walker};
use crate::closure_prefetch;
use crate::closure_seeds;
use crate::closure_target;
use crate::error::{Result, invalid};
use crate::head_validation::{ValidationRead, ValidationRecorder};
use crate::references::{ResourceReference, collect_with};
use crate::resource_reach::ResourceReach;
use crate::urls::local_target;

pub(crate) fn collect(
    walker: &Walker,
    route: &str,
    tree: &[Node],
    seeds: &[String],
    recorder: &dyn ValidationRecorder,
) -> Result<Closure> {
    recorder.input(ValidationRead::Policy, "");
    recorder.input(ValidationRead::Document, route);
    let mut result = Closure::default();
    let source = namespace::generated(route);
    let references = collect_with(tree, &|css| walker.index.style_references(css));
    let mut queue: VecDeque<_> = references
        .iter()
        .cloned()
        .map(|reference| (source.clone(), reference))
        .collect();
    let (seeded, warnings) = closure_seeds::queue(route, seeds);
    queue.extend(seeded);
    result.warnings.extend(warnings);
    closure_prefetch::prefetch(walker, &source, &references)?;
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
        if !target.starts_with(&namespace::generated(""))
            && let Some(path) = target.strip_prefix("static/")
        {
            recorder.observe(path);
            if let Some(observer) = &walker.observer {
                observer.observe(route, path);
            }
        }
        if target.starts_with(&namespace::generated("")) {
            recorder.input(ValidationRead::GeneratedMembership, &target);
        }
        if let Some(generated) = target.strip_prefix(&namespace::generated(""))
            && walker.generated.is_document(generated)
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
            let Some(urls) = closure_target::read(
                walker,
                route,
                &target,
                &reference.url,
                recorder,
                &mut result,
            )?
            else {
                continue;
            };
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
