"""Seed a separate legacy publication after today's receiver accepts its source."""

import hashlib
import json
from pathlib import Path
import subprocess
import sys
import uuid


database, root, source, target, version = sys.argv[1:]
source, target = str(uuid.UUID(source)), str(uuid.UUID(target))
head = hashlib.sha256(target.encode()).hexdigest()[:40]


def sql(value):
    return "'" + str(value).replace("'", "''") + "'"


def query(statement):
    return subprocess.run(
        ["psql", database, "-XAt", "-v", "ON_ERROR_STOP=1"],
        input=statement, capture_output=True, text=True, check=True,
    ).stdout


rows = json.loads(query(f"""
    SELECT json_agg(json_build_object(
        'path', f.path, 'hash', f.blob_hash, 'incarnation', b.incarnation,
        'size', b.size, 'contentType', f.content_type, 'project', f.project_id))
    FROM publication_files f JOIN blobs b
      ON b.project_id=f.project_id AND b.hash=f.blob_hash
    JOIN publications p ON p.id=f.publication_id
    WHERE p.id={sql(source)} AND p.state='ready';
"""))
files = {row["path"]: row for row in rows}


def read(path):
    row = files[path]
    return json.loads((Path(root) / "sha256" / row["hash"] / row["incarnation"]).read_bytes())


changed = {}
for path in files:
    if path.startswith("mokly-viewer/entries/") and path.endswith(".json"):
        detail = read(path)
        detail["schemaVersion"] = int(version)
        changed[path] = json.dumps(detail).encode()
envelope = read("mokly-upload.json")
envelope["headSha"] = head
changed["mokly-upload.json"] = json.dumps(envelope).encode()
marker = read(".mokly-export-artifact")
for file in marker["files"]:
    if file["path"] in changed:
        data = changed[file["path"]]
        file.update(sha256=hashlib.sha256(data).hexdigest(), size=len(data))
changed[".mokly-export-artifact"] = json.dumps(marker).encode()

statements = ["BEGIN;", f"""
    INSERT INTO publications
      (id,project_id,branch,head_sha,base_ref,base_sha,pull_request,config_path,
       exported_at,state,created_at,deadline)
    SELECT {sql(target)},project_id,branch,{sql(head)},base_ref,base_sha,
           pull_request,config_path,exported_at,'validating',now(),now()+interval '1 hour'
    FROM publications WHERE id={sql(source)} AND state='ready';
"""]
for path, data in changed.items():
    row = files[path]
    digest = hashlib.sha256(data).hexdigest()
    incarnation = str(uuid.uuid4())
    object_path = Path(root) / "sha256" / digest / incarnation
    object_path.parent.mkdir(parents=True, exist_ok=True)
    object_path.write_bytes(data)
    statements.append(f"""
        INSERT INTO blobs
          (project_id,hash,incarnation,size,content_type,unreferenced_at,stored_at)
        VALUES ({sql(row['project'])},{sql(digest)},{sql(incarnation)},
                {len(data)},{sql(row['contentType'])},now(),now())
        ON CONFLICT (project_id,hash) DO NOTHING;
    """)
    row["hash"] = digest
for path, row in files.items():
    statements.append(f"""
        INSERT INTO publication_files
          (publication_id,project_id,path,blob_hash,content_type)
        VALUES ({sql(target)},{sql(row['project'])},{sql(path)},
                {sql(row['hash'])},{sql(row['contentType'])});
    """)
statements.append(f"""
    INSERT INTO publication_screen_views (publication_id,screen_path,screen_hash,viewport,scheme)
    SELECT {sql(target)},screen_path,screen_hash,viewport,scheme
    FROM publication_screen_views WHERE publication_id={sql(source)};
    UPDATE publications target
    SET state='ready',changes_state=source.changes_state,changes_added=source.changes_added,
        changes_changed=source.changes_changed,changes_removed=source.changes_removed
    FROM publications source WHERE target.id={sql(target)} AND source.id={sql(source)};
    INSERT INTO publication_events (id,publication_id,kind,created_at,next_attempt_at)
    VALUES ({sql(uuid.uuid4())},{sql(target)},'ready',now(),now());
    COMMIT;
""")
query("\n".join(statements))
