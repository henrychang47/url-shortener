import argparse
import base64
import json
from pathlib import Path


def encode_text(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode("ascii")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--backend-image", required=True)
    parser.add_argument("--frontend-image", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--compose-prod", required=True)
    parser.add_argument("--nginx-conf", required=True)
    args = parser.parse_args()

    files = {
        "/opt/url-shortener/compose.prod.yaml": encode_text(Path(args.compose_prod)),
        "/opt/url-shortener/nginx/conf.d/default.conf": encode_text(
            Path(args.nginx_conf)
        ),
    }

    commands = [
        "set -euo pipefail",
        "install -d /opt/url-shortener/nginx/conf.d",
    ]

    for destination, content in files.items():
        commands.append(f"printf '%s' '{content}' | base64 -d > {destination}")

    commands.extend(
        [
            "cd /opt/url-shortener",
            "test -f .env",
            f"export BACKEND_IMAGE='{args.backend_image}'",
            f"export FRONTEND_IMAGE='{args.frontend_image}'",
            "docker compose --env-file .env -f compose.prod.yaml pull backend migrate nginx cloudflare-tunnel",
            "docker compose --env-file .env -f compose.prod.yaml up -d postgres-db redis",
            "docker compose --env-file .env -f compose.prod.yaml up --abort-on-container-exit --exit-code-from migrate migrate",
            "docker compose --env-file .env -f compose.prod.yaml up -d backend nginx cloudflare-tunnel",
            "curl --fail --silent --show-error http://localhost/health",
            "docker compose --env-file .env -f compose.prod.yaml ps",
            "docker image prune -f",
        ]
    )

    payload = {
        "commands": commands,
        "executionTimeout": ["3600"],
    }
    Path(args.output).write_text(json.dumps(payload), encoding="utf-8")


if __name__ == "__main__":
    main()
