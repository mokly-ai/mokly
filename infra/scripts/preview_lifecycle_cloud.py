"""Cloudflare DNS ownership and mutation for PR preview lifecycles."""

import json
import os
from pathlib import Path
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from preview_lifecycle_core import preview_parts


CLOUDFLARE_API = "https://api.cloudflare.com/client/v4"
IDENTIFIER = re.compile(r"[a-f0-9]{32}")


def cloudflare_request(method, path, token, payload=None, opener=None):
    """Call Cloudflare and require both HTTP and envelope success."""
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    request = Request(
        CLOUDFLARE_API + path,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        response = (opener or urlopen)(request, timeout=10)
        with response:
            status = response.status
            body = response.read()
    except HTTPError as error:
        body = error.read()
        raise ValueError(f"Cloudflare HTTP {error.code}: {api_error(body)}") from error
    except URLError as error:
        raise ValueError(f"Cloudflare request failed: {error.reason}") from error
    if not 200 <= status < 300:
        raise ValueError(f"Cloudflare HTTP {status}")
    try:
        value = json.loads(body)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("Cloudflare returned malformed JSON") from error
    if not isinstance(value, dict) or value.get("success") is not True:
        raise ValueError(f"Cloudflare API failed: {api_error(body)}")
    return value


def api_error(body):
    try:
        value = json.loads(body)
        errors = value.get("errors", []) if isinstance(value, dict) else []
        messages = [f"{item.get('code')}: {item.get('message')}" for item in errors if isinstance(item, dict)]
        return "; ".join(messages) or "provider error"
    except (UnicodeDecodeError, json.JSONDecodeError):
        return "malformed response"


def list_dns_records(zone, name, token, opener=None):
    """Page through every record with the exact name; malformed pagination is a failure."""
    records = []
    page = 1
    while True:
        query = urlencode({"name": name, "page": page, "per_page": 100})
        value = cloudflare_request(
            "GET", f"/zones/{zone}/dns_records?{query}", token, opener=opener
        )
        result = value.get("result")
        info = value.get("result_info")
        if (
            not isinstance(result, list)
            or any(not isinstance(item, dict) for item in result)
            or not isinstance(info, dict)
        ):
            raise ValueError("Cloudflare DNS list response is malformed")
        current, total = info.get("page"), info.get("total_pages")
        if type(current) is not int or type(total) is not int or current != page or total < 1 or page > total:
            raise ValueError("Cloudflare DNS pagination is malformed")
        records.extend(result)
        if page == total:
            return records
        page += 1


def dns_configuration(environment, variables):
    number, _, _ = preview_parts(environment)
    zone = variables["MKC_CATALOGUE_CLOUDFLARE_ZONE_ID"]
    if not IDENTIFIER.fullmatch(zone):
        raise ValueError("invalid catalogue Cloudflare zone ID")
    name = f"*.pr-{number}.preview.{variables['MKC_CATALOGUE_BASE_DOMAIN']}"
    marker = f"mokly-preview:{environment}"
    return zone, name, marker


def read_token(path):
    token = Path(path).read_text().strip()
    if not token or any(character.isspace() for character in token):
        raise ValueError("catalogue DNS token is empty or malformed")
    return token


def require_record_id(record, expected=None):
    identifier = record.get("id") if isinstance(record, dict) else None
    if not isinstance(identifier, str) or not IDENTIFIER.fullmatch(identifier):
        raise ValueError("Cloudflare DNS response has no canonical record ID")
    if expected is not None and identifier != expected:
        raise ValueError("Cloudflare DNS response returned a different record ID")
    return identifier


def upsert_dns(environment, token_path, variables=os.environ, opener=None):
    """Create the marked exact A record or adopt an owned one.

    The token comes from the private file and goes only into the authorization
    header. An owned record is updated with PUT only when it differs from the
    complete desired shape; a duplicate or an unowned exact name fails, and
    record IDs come from the provider's response."""
    zone, name, marker = dns_configuration(environment, variables)
    token = read_token(token_path)
    exact = [item for item in list_dns_records(zone, name, token, opener) if item.get("name") == name]
    if len(exact) > 1:
        raise ValueError(f"multiple Cloudflare records exist for {name}")
    desired = {
        "type": "A",
        "name": name,
        "content": variables["MKC_PREVIEW_INGRESS_IP"],
        "proxied": False,
        "ttl": 300,
        "comment": marker,
    }
    if not exact:
        result = cloudflare_request(
            "POST", f"/zones/{zone}/dns_records", token, desired, opener
        ).get("result")
        return require_record_id(result)
    record = exact[0]
    if record.get("comment") != marker:
        raise ValueError(f"Cloudflare record {name} is not owned by {marker}")
    identifier = require_record_id(record)
    if any(record.get(key) != value for key, value in desired.items()):
        result = cloudflare_request(
            "PUT", f"/zones/{zone}/dns_records/{identifier}", token, desired, opener
        ).get("result")
        require_record_id(result, identifier)
    return identifier


def delete_dns(environment, token_path, variables=os.environ, opener=None):
    zone, name, marker = dns_configuration(environment, variables)
    token = read_token(token_path)
    owned = [
        item for item in list_dns_records(zone, name, token, opener)
        if item.get("name") == name and item.get("type") == "A" and item.get("comment") == marker
    ]
    if len(owned) > 1:
        raise ValueError(f"multiple marked Cloudflare records exist for {name}")
    if not owned:
        return None
    identifier = require_record_id(owned[0])
    result = cloudflare_request(
        "DELETE", f"/zones/{zone}/dns_records/{identifier}", token, opener=opener
    ).get("result")
    require_record_id(result, identifier)
    return identifier
