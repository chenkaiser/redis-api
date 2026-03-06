#!/usr/bin/env python3
"""
Keycloak post-import initialisation script.

The realm-export.json seeds client secrets with the placeholder value
"to-be-set-by-init". This script runs once (as the keycloak-init container)
after Keycloak is healthy and overwrites those placeholders with the real
secrets taken from environment variables.

Required env vars:
  KEYCLOAK_INTERNAL_URL         e.g. http://keycloak:8080
  KEYCLOAK_REALM                e.g. redis-api
  KEYCLOAK_ADMIN_USER           Keycloak master-realm admin username
  KEYCLOAK_ADMIN_PASSWORD       Keycloak master-realm admin password
  KEYCLOAK_ADMIN_CLIENT_SECRET  Real secret for the auth-service client
  ORDER_CONSUMER_CLIENT_SECRET  Real secret for the order-consumer client
"""

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

KC_URL = os.environ["KEYCLOAK_INTERNAL_URL"].rstrip("/")
REALM = os.environ["KEYCLOAK_REALM"]
ADMIN_USER = os.environ["KEYCLOAK_ADMIN_USER"]
ADMIN_PASSWORD = os.environ["KEYCLOAK_ADMIN_PASSWORD"]
ADMIN_CLIENT_SECRET = os.environ["KEYCLOAK_ADMIN_CLIENT_SECRET"]
ORDER_CONSUMER_SECRET = os.environ["ORDER_CONSUMER_CLIENT_SECRET"]


def wait_for_keycloak(timeout_s: int = 120) -> None:
    url = f"{KC_URL}/realms/{REALM}"
    print(f"Waiting for Keycloak at {url} ...", flush=True)
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        try:
            urllib.request.urlopen(url, timeout=3)
            print("Keycloak is ready.", flush=True)
            return
        except Exception:
            time.sleep(2)
    print("ERROR: Timed out waiting for Keycloak.", file=sys.stderr)
    sys.exit(1)


def get_admin_token() -> str:
    url = f"{KC_URL}/realms/master/protocol/openid-connect/token"
    data = urllib.parse.urlencode(
        {
            "grant_type": "password",
            "client_id": "admin-cli",
            "username": ADMIN_USER,
            "password": ADMIN_PASSWORD,
        }
    ).encode()
    req = urllib.request.Request(url, data=data)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())["access_token"]


def get_client_uuid(token: str, client_id: str) -> str:
    url = f"{KC_URL}/admin/realms/{REALM}/clients?clientId={urllib.parse.quote(client_id)}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req) as resp:
        clients = json.loads(resp.read())
    if not clients:
        raise ValueError(f"Client '{client_id}' not found in realm '{REALM}'")
    return clients[0]["id"]


def update_client_secret(token: str, client_id: str, secret: str) -> None:
    uuid = get_client_uuid(token, client_id)
    url = f"{KC_URL}/admin/realms/{REALM}/clients/{uuid}/client-secret"
    data = json.dumps({"value": secret}).encode()
    req = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req):
        pass
    print(f"Secret updated for client '{client_id}'.", flush=True)


def main() -> None:
    wait_for_keycloak()

    print("Obtaining admin token ...", flush=True)
    token = get_admin_token()

    update_client_secret(token, "auth-service", ADMIN_CLIENT_SECRET)
    update_client_secret(token, "order-consumer", ORDER_CONSUMER_SECRET)

    print("Keycloak init complete.", flush=True)


if __name__ == "__main__":
    main()
