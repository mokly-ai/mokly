//! Literal catalogue, document, closure, and resource inputs for public comparison calls.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_catalogue::html_input::DeliveredHtml;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_graph::cache::Artifact;
use mokly_graph::closure::Closure;
use mokly_graph::resource_reach::ResourceReach;
use mokly_html::composition::Composed;
use mokly_html::tree::{Node, Region, RegionKind};
use mokly_html::{parse, tree};
use mokly_model::axes::ColorScheme;
use mokly_model::catalogue::{CatalogueModel, EntryContent, ModelEntry, VisualEntry};
use mokly_model::evidence::{EvidenceOwner, ResourceEvidence};
use mokly_model::usage::{CatalogueUsage, ComponentInputOwner, ComponentInstanceRecord};
use mokly_model::wire_props::{ComponentWireValue, StringTag};
use serde_json::json;

#[derive(Clone)]
pub(super) struct Fixture {
    pub(super) entries: Vec<ModelEntry>,
    pub(super) html: BTreeMap<String, String>,
    pub(super) resources: BTreeMap<String, Vec<u8>>,
    pub(super) badge: String,
    pub(super) label: String,
    pub(super) ignored: String,
    pub(super) review_ignore: bool,
    pub(super) known: bool,
}
impl Default for Fixture {
    fn default() -> Self {
        Self { entries: ["one", "two", "badge"].into_iter().map(entry).collect(),
            html: BTreeMap::from([("one".into(), "<p>module one</p>".into()), ("two".into(), "<p>module two</p>".into()), ("badge".into(), "<p class=card>Badge</p>".into())]),
            resources: BTreeMap::from([
                ("static/theme.css".into(), b"@import '/static/nested.css'; .card{color:red}".to_vec()),
                ("static/nested.css".into(), b".card{margin:1px}".to_vec()),
                ("static/icon.png".into(), b"image one".to_vec()),
                ("static/ignored.png".into(), b"ignored one".to_vec()),
                ("static/child.html".into(), b"<link rel=stylesheet href='/static/embedded.css'><p class=embedded>Embedded</p>".to_vec()),
                ("static/embedded.css".into(), b".embedded{padding:1px}".to_vec()),
            ]), badge: "badge".into(), label: "Label".into(), ignored: "clock one".into(), review_ignore: true, known: true }
    }
}
impl Fixture {
    pub(super) fn catalogue(&self) -> PreparedCatalogue {
        PreparedCatalogue {
            model: CatalogueModel {
                entries: self.entries.clone(),
                folders: vec![],
                sources: self
                    .entries
                    .iter()
                    .map(|entry| entry.metadata.source.path.clone())
                    .collect(),
                color_schemes: vec![ColorScheme::Light],
            },
            inventory: Default::default(),
            templates: Default::default(),
            documents: Default::default(),
            slot_fragments: Default::default(),
            elements: Default::default(),
            prop_validators: Default::default(),
            javascript: Default::default(),
            dependency_directories: Default::default(),
            warnings: vec![warning("base-dependencies", "dependency warning")],
        }
    }
    pub(super) fn usage(&self, path: &str) -> CatalogueUsage {
        let instances = if path == self.badge {
            vec![]
        } else {
            vec![ComponentInstanceRecord {
                key: "instance".into(),
                id: "badge".into(),
                component_id: self.badge.clone(),
                owner: ComponentInputOwner::Entry,
                slot_key: None,
                order: 0,
                props: BTreeMap::from([(
                    "label".into(),
                    ComponentWireValue::String(StringTag::Value, self.label.clone()),
                )]),
                props_key: self.label.clone(),
                source: None,
            }]
        };
        CatalogueUsage::Ready {
            instances,
            slots: vec![],
            ranges: vec![],
        }
    }
    pub(super) fn artifact(&self, path: &str) -> Arc<Artifact> {
        let mut nodes = parse::html(DeliveredHtml::document(&self.html[path]));
        let ignored = vec![
            Node::Text(self.ignored.clone()),
            tree::element("img", &[("src", "/static/ignored.png")], vec![]),
        ];
        if self.review_ignore {
            nodes.push(Node::Region {
                region: Region {
                    id: "ignore".into(),
                    kind: RegionKind::Ignore {
                        id: "clock".into(),
                        material_key: None,
                    },
                },
                children: ignored,
            });
        } else {
            nodes.extend(ignored);
        }
        nodes.push(tree::element(
            "link",
            &[("rel", "stylesheet"), ("href", "/static/theme.css")],
            vec![],
        ));
        nodes.push(tree::element(
            "iframe",
            &[("src", "/static/child.html")],
            vec![],
        ));
        nodes.push(tree::element("img", &[("src", "/static/icon.png")], vec![]));
        if path == self.badge {
            nodes = vec![Node::Region {
                region: Region {
                    id: "root".into(),
                    kind: RegionKind::Root {
                        path: self.badge.clone(),
                    },
                },
                children: nodes,
            }];
        } else {
            nodes.push(Node::Region {
                region: Region {
                    id: "r1".into(),
                    kind: RegionKind::Instance {
                        path: self.badge.clone(),
                        key: "instance".into(),
                        local_id: "badge".into(),
                        props_key: self.label.clone(),
                    },
                },
                children: vec![tree::element(
                    "p",
                    &[("class", "card")],
                    vec![Node::Text(self.label.clone())],
                )],
            });
        }
        let bytes = format!(
            "{}:{}:{}:{}",
            self.html[path], self.badge, self.label, self.ignored
        )
        .into_bytes();
        Arc::new(Artifact {
            bytes,
            content_type: "text/html".into(),
            fragment: None,
            document: Some(Composed {
                tree: nodes,
                usage: self.usage(path),
                warnings: vec![],
                resources: vec![],
                components: vec![self.badge.clone()],
                links: vec![],
            }),
        })
    }
    pub(super) fn closure(&self, _path: &str) -> Closure {
        let routes = [
            "static/theme.css",
            "static/nested.css",
            "static/icon.png",
            "static/child.html",
            "static/ignored.png",
        ];
        let routes: Vec<_> = routes
            .into_iter()
            .filter(|route| self.resources.contains_key(*route))
            .collect();
        Closure {
            warnings: vec![warning("base-conversion", "conversion warning")],
            files: routes
                .iter()
                .map(|route| route.strip_prefix("static/").unwrap().into())
                .collect(),
            edges: routes
                .iter()
                .map(|route| ((*route).into(), vec![]))
                .collect(),
            evidence: routes
                .iter()
                .map(|route| ResourceEvidence {
                    path: (*route).into(),
                    owner: EvidenceOwner::Entry,
                })
                .collect(),
            references: vec![ResourceReach {
                path: "static/icon.png".into(),
                owner: EvidenceOwner::Component {
                    path: self.badge.clone(),
                },
                instance_key: Some("instance".into()),
                source: "static/child.html".into(),
                url: "/static/icon.png".into(),
            }],
        }
    }
    pub(super) fn moved(&mut self) {
        let path = "marker";
        let index = self
            .entries
            .iter()
            .position(|entry| entry.metadata.path == self.badge)
            .unwrap();
        self.entries[index].metadata.moved_from = Some(self.badge.clone());
        self.entries[index].metadata.path = path.into();
        let html = self.html.remove(&self.badge).unwrap();
        self.html.insert(path.into(), html);
        self.badge = path.into();
    }
    pub(super) fn remove_ignore_without_changing_bytes(&mut self) {
        let delivered: Vec<_> = self
            .entries
            .iter()
            .map(|entry| self.artifact(&entry.metadata.path).bytes.clone())
            .collect();
        self.review_ignore = false;
        let current: Vec<_> = self
            .entries
            .iter()
            .map(|entry| self.artifact(&entry.metadata.path).bytes.clone())
            .collect();
        assert_eq!(
            current, delivered,
            "ReviewIgnore changes annotations without changing delivered HTML bytes"
        );
    }
}
fn entry(path: &str) -> ModelEntry {
    let visual = VisualEntry {
        color_schemes: vec![ColorScheme::Light],
        prop_schema: serde_json::from_value(
            json!({"type":"object","additionalProperties":false,"properties":{}}),
        )
        .unwrap(),
        props: Default::default(),
        controls: Default::default(),
        control_order: vec![],
    };
    ModelEntry { metadata: serde_json::from_value(json!({"path":path,"title":path,"description":"","tags":[],"relatedDocs":[],"isIndex":false,"source":{"path":format!("specs/{path}.tsx"),"line":1,"column":1},"rootIndex":0})).unwrap(), content: if path == "badge" { EntryContent::Component { visual, element: None, slots: vec![], supplied_slots: vec![] } } else { EntryContent::Screen { visual, address: Some(format!("/{path}")), use_case_paths: vec![] } } }
}
fn warning(code: &'static str, message: &str) -> Warning {
    Warning {
        code,
        subject: WarningSubject::Route("base input".into()),
        message: message.into(),
    }
}
