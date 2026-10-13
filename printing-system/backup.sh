#!/usr/bin/env bash

# Create a shareable ZIP backup, omitting dependencies, secrets, and local data.
# Usage: ./backup.sh [backup-directory]

set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_name="$(basename "$project_dir")"
backup_dir="${1:-$(dirname "$project_dir")/backups}"
timestamp="$(date +%Y%m%d-%H%M%S)"
archive_path="$backup_dir/${project_name}-${timestamp}.zip"

if ! command -v python3 >/dev/null 2>&1; then
  echo "Error: 'python3' is required to safely filter files for the backup." >&2
  exit 1
fi

mkdir -p "$backup_dir"
backup_dir="$(cd "$backup_dir" && pwd)"

# Storing the archive inside the project would make the next backup include it.
case "$backup_dir" in
  "$project_dir"|"$project_dir"/*)
    echo "Error: choose a backup directory outside $project_dir." >&2
    exit 1
    ;;
esac

echo "Creating backup: $archive_path"
PROJECT_DIR="$project_dir" ARCHIVE_PATH="$archive_path" python3 - <<'PY'
import os
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(os.environ["PROJECT_DIR"])
archive = Path(os.environ["ARCHIVE_PATH"])
secret_suffixes = {".pem", ".key", ".p12", ".pfx", ".jks", ".keystore"}
secret_names = {"id_rsa", "id_dsa", "id_ecdsa", "id_ed25519", "credentials.json",
                "service-account.json", "firebase-adminsdk.json"}
excluded_dirs = {"node_modules", ".git", ".firebase", ".wrangler",
                 ".print-agent-state", "uploads"}

with ZipFile(archive, "w", ZIP_DEFLATED) as bundle:
    for path in root.rglob("*"):
        relative = path.relative_to(root)
        parts = relative.parts
        if path.is_dir():
            continue
        if any(part in excluded_dirs for part in parts[:-1]):
            continue
        name = path.name
        if name in {".env.example", ".env.sample", ".env.template"}:
            pass
        elif name == ".env" or (name.startswith(".env.") and not name.endswith((".example", ".sample", ".template"))):
            continue
        if name in secret_names or path.suffix.lower() in secret_suffixes:
            continue
        if name.endswith((".log", ".zip")) or name == ".DS_Store":
            continue
        if path.is_file() and not path.is_symlink():
            bundle.write(path, Path(root.name) / relative)
PY

echo "Backup complete: $archive_path"
