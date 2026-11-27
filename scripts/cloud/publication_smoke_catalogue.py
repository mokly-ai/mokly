"""Private/public delivery and one-use capability integration assertions."""

import hashlib

from publication_smoke_support import exchange_catalogue_grant


def private_access(api, catalogue, owner, project, publication, fixture_files):
    path = "/v1/projects/" + project["id"] + "/publications/" + publication["id"] + "/access-grants"
    catalogue.fetch(publication, expected=401)
    api.call("POST", path, {}, expected=401)
    grant, _ = api.call("POST", path, {}, owner, 201)
    assert api.sql("SELECT count(*) FROM catalogue_grants WHERE digest='" + hashlib.sha256(grant["grant"].encode()).hexdigest() + "'") == "1"
    cookie, _ = exchange_catalogue_grant(catalogue, publication, grant["grant"], api.origin)
    catalogue.fetch(publication, "/_access", "POST", {"grant": grant["grant"]}, origin=api.origin, expected=401)
    fragment = next(name for name in fixture_files if name.startswith("static/") and name.endswith(".html"))
    for route, owned, status in [("/", "index.html", 200), ("/index.html", "index.html", 200), ("/" + fragment, fragment, 200), ("/404.html", "404.html", 200), ("/unknown/route", "404.html", 404)]:
        body, headers = catalogue.fetch(publication, route, cookie=cookie, expected=status)
        assert body == fixture_files[owned]
        assert headers["cache-control"] == "no-store"
        assert headers["content-type"] == "text/html"
        head, metadata = catalogue.fetch(publication, route, method="HEAD", cookie=cookie, expected=status)
        assert head == b"" and int(metadata["content-length"]) == len(body)
    for route in ["/mokly-upload.json", "/.mokly-export-artifact"]:
        body, _ = catalogue.fetch(publication, route, cookie=cookie, expected=404)
        assert body == fixture_files["404.html"]
    altered = cookie[:-1] + ("0" if cookie[-1] != "0" else "1")
    _, invalid_headers = catalogue.fetch(publication, cookie=altered, expected=401)
    assert "Max-Age=0" in invalid_headers["set-cookie"]
    private_hash = hashlib.sha256(fixture_files["index.html"]).hexdigest()
    private_body, private_headers = catalogue.fetch(
        publication,
        cookie=cookie,
        request_headers={"Accept-Encoding": "gzip, br", "If-None-Match": 'W/"' + private_hash + '"'},
    )
    assert private_body == fixture_files["index.html"]
    assert "content-encoding" not in private_headers
    assert private_headers["cache-control"] == "no-store"
    print("PASS private grants: one-use exchange, signed cookies, GET/HEAD, fragments, 404 and identity delivery")
    return cookie


def public_delivery(api, catalogue, owner, project, publication, files):
    project_path = "/v1/projects/" + project["id"]
    api.call("PATCH", project_path, {"name": project["name"], "slug": project["slug"], "visibility": "public", "requireApproval": False, "version": 1}, owner)
    body, headers = catalogue.fetch(publication)
    assert body == files["index.html"] and headers["cache-control"] == "no-cache"
    assert headers["etag"] == 'W/"' + hashlib.sha256(files["index.html"]).hexdigest() + '"'
    assert headers["accept-ranges"] == "bytes"
    ranged, range_headers = catalogue.fetch(
        publication,
        request_headers={"Range": "bytes=2-7", "Accept-Encoding": "gzip, br"},
        expected=206,
    )
    assert ranged == files["index.html"][2:8]
    assert range_headers["content-range"] == "bytes 2-7/" + str(len(files["index.html"]))
    assert range_headers["content-length"] == "6"
    assert "content-encoding" not in range_headers
    unsatisfied, unsatisfied_headers = catalogue.fetch(
        publication, request_headers={"Range": "bytes=999999-"}, expected=416
    )
    assert unsatisfied == b""
    assert unsatisfied_headers["content-range"] == "bytes */" + str(len(files["index.html"]))
    unchanged, unchanged_headers = catalogue.fetch(
        publication, request_headers={"If-None-Match": headers["etag"]}, expected=304
    )
    assert unchanged == b""
    assert unchanged_headers["etag"] == headers["etag"]
    compressed, compressed_headers = catalogue.fetch(
        publication,
        "/mokly-viewer/index.json",
        request_headers={"Accept-Encoding": "gzip, br"},
    )
    assert compressed and compressed_headers["content-encoding"] == "br"
    assert "content-length" not in compressed_headers
    assert compressed_headers["accept-ranges"] == "bytes"
    for route in ["/__mokly", "/__Mokly/", "/%5f%5fMoKlY/catalogue.json"]:
        body, metadata = catalogue.fetch(publication, route, expected=404,
                                         request_headers={"Accept-Encoding": "br", "If-None-Match": "*"})
        assert body == files["404.html"] and metadata["cache-control"] == "no-store"
        assert "location" not in metadata and "content-encoding" not in metadata
        head, headers = catalogue.fetch(publication, route, method="HEAD", expected=404)
        assert head == b"" and int(headers["content-length"]) == len(body)
        assert headers["etag"] == metadata["etag"] and headers["cache-control"] == "no-store"
    comparison = next(path for path in files if path.startswith("mokly-viewer/diffs/") and path.endswith(".html"))
    for route in ["/" + comparison, "/__blobs/" + hashlib.sha256(files[comparison]).hexdigest() + "/" + comparison]:
        body, metadata = catalogue.fetch(publication, route, request_headers={"If-None-Match": "*", "Accept-Encoding": "br"})
        assert body == files[comparison] and metadata["cache-control"] == "no-store"
        assert "content-encoding" not in metadata
    stale_body, stale_headers = catalogue.fetch(publication, cookie="__Host-mkc_catalogue=stale")
    assert stale_body == files["index.html"]
    assert "Max-Age=0" in stale_headers["set-cookie"]
    assert stale_headers["cache-control"] == "no-store"
    digest = hashlib.sha256(files["index.html"]).hexdigest()
    body, headers = catalogue.fetch(publication, "/__blobs/" + digest + "/index.html")
    assert body == files["index.html"] and headers["cache-control"] == "public, max-age=31536000, immutable"
    catalogue.fetch(publication, "/__blobs/" + "0" * 64 + "/index.html", expected=404)
    large_path, large_bytes = max(files.items(), key=lambda item: len(item[1]))
    body, headers = catalogue.fetch(publication, "/" + large_path)
    assert body == large_bytes and int(headers["content-length"]) == len(large_bytes)
    body, headers = catalogue.fetch(publication, "/missing-streamed-file", expected=404)
    assert body == files["404.html"] and headers["cache-control"] == "no-store"
    branch = api.sql("SELECT branch FROM publications WHERE id='" + publication["id"] + "'")
    alias = "b-" + hashlib.sha256((project["id"] + "\0" + branch).encode()).hexdigest()[:40] + ".localhost:8082"
    _, headers = catalogue.fetch(publication, "/index.html?view=changes", host=alias, expected=307)
    assert headers["location"] == publication["catalogueUrl"] + "/index.html?view=changes"
    assert headers["cache-control"] == "no-store"
    print("PASS public delivery: compression, ranges, validators, immutable blobs and branch alias")


def revoke_access(api, catalogue, owner, project, publication):
    guest = api.signup()
    project_path = "/v1/projects/" + project["id"]
    grant_path = project_path + "/publications/" + publication["id"] + "/access-grants"
    member, _ = api.call("POST", project_path + "/members", {"userId": guest["user"]["id"], "role": "reviewer"}, owner, 201)
    grant, _ = api.call("POST", grant_path, {}, guest, 201)
    cookie, _ = exchange_catalogue_grant(catalogue, publication, grant["grant"], api.origin)
    catalogue.fetch(publication, cookie=cookie)
    api.call("DELETE", project_path + "/members/" + member["id"], {"version": 1}, owner, 204)
    catalogue.fetch(publication, cookie=cookie, expected=404)
    grant, _ = api.call("POST", grant_path, {}, owner, 201)
    api.sql("UPDATE catalogue_grants SET expires_at=now() WHERE digest='" + hashlib.sha256(grant["grant"].encode()).hexdigest() + "'")
    catalogue.fetch(publication, "/_access", "POST", {"grant": grant["grant"]}, origin=api.origin, expected=401)
    print("PASS current membership revocation and grant expiry are enforced at delivery")
