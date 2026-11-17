"""Parse Helm output with the workspace's locked YAML parser."""

import json
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[3]
CHART = ROOT / "infra/helm/mokly-cloud"


def parse_yaml(text):
    script = """
const fs = require('node:fs');
const yaml = require('./ts/node_modules/yaml');
const docs = yaml.parseAllDocuments(fs.readFileSync(0, 'utf8'));
for (const doc of docs) if (doc.errors.length) throw doc.errors[0];
process.stdout.write(JSON.stringify(docs.map(doc => doc.toJS()).filter(Boolean)));
"""
    result = subprocess.run(["node", "-e", script], input=text, cwd=ROOT,
                            capture_output=True, text=True, check=True, timeout=30)
    return json.loads(result.stdout)


def resource(documents, kind, name):
    matches = [doc for doc in documents if doc["kind"] == kind and doc["metadata"]["name"] == name]
    assert len(matches) == 1, (kind, name, len(matches))
    return matches[0]


def environment(container):
    entries = container.get("env", [])
    result = {entry["name"]: {key: value for key, value in entry.items() if key != "name"}
              for entry in entries}
    assert len(entries) == len(result), "duplicate environment keys"
    return result
