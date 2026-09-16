#!/usr/bin/env bash
#
# bootstrap-alf-data.sh — make the Alfresco content store writable before the first start.
#
# The repository container runs as uid/gid 33000 (`alfresco`) and writes its content store into
# `./data/alf_data`, which is a **bind mount** — so it comes from the host, not from the image.
# `data*/` is gitignored, so on a fresh checkout the directory does not exist: Docker creates the
# bind-mount source as `root:root 0755`, the container cannot create `contentstore.deleted` inside
# it, and Alfresco's `FileContentStore` constructor throws:
#
#   Caused by: ContentIOException: 08160000 Failed to create store root: ./alf_data/contentstore.deleted
#   Caused by: BeanInstantiationException: Failed to instantiate [FileContentStore]
#   SEVERE: Context [/alfresco] startup failed due to previous errors
#
# The webapp then never deploys, the container reports `unhealthy`, and `docker compose up` fails
# with "dependency failed to start: container … is unhealthy" — which reads like a model or
# database problem and is neither. A working instance only works because someone chmodded the
# directory by hand once; this script is the tracked version of that step.
#
# Idempotent: safe to re-run, and safe on an existing store (it only adjusts the root directory's
# permissions, not its contents).
#
# Usage: ./scripts/bootstrap-alf-data.sh   (run from this repository, or from anywhere)

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STORE_DIR="${REPO_DIR}/data/alf_data"
ALFRESCO_UID=33000
ALFRESCO_GID=33000

# The container user does not exist on the host, so ownership is only available to root. Everyone
# else gets the group/world-writable directory the runbook has always documented for a checkout.
if [[ "$(id -u)" == "0" ]]; then
  mkdir -p "${STORE_DIR}"
  chown -R "${ALFRESCO_UID}:${ALFRESCO_GID}" "${STORE_DIR}"
  echo "bootstrap-alf-data: ${STORE_DIR} owned by ${ALFRESCO_UID}:${ALFRESCO_GID}"
else
  mkdir -p "${STORE_DIR}"
  if ! chmod 0777 "${STORE_DIR}" 2>/dev/null; then
    echo "bootstrap-alf-data: cannot chmod ${STORE_DIR} — run it as root, or fix the permissions yourself" >&2
    exit 1
  fi
  chmod 0777 "${STORE_DIR}"/* 2>/dev/null || true
  echo "bootstrap-alf-data: ${STORE_DIR} is world-writable (re-run with sudo to chown ${ALFRESCO_UID}:${ALFRESCO_GID} instead)"
fi
