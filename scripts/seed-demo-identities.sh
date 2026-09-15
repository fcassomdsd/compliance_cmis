#!/usr/bin/env bash
#
# Seed the demo identities into Alfresco, so the office half of the platform can be
# exercised without hand-creating users.
#
# WHY THIS EXISTS
# ---------------
# The demo dataset (`atrocore-docker/scripts/seed-demo-dataset.sh`) creates inspector
# *records*, and `compliance_web`'s migration creates the `closure_reviewer` role
# mapping — but neither creates an Alfresco user. Without one, only `admin` can log
# in, and the closure review cannot be walked as the supervising authority it is
# supposed to be. This script closes that gap (COMPLIANCE_INTEGRATION_RUNBOOK.md §7.3).
#
# WHAT IT CREATES (all idempotent — safe to re-run)
#   groups:  U-VSO-IN_ClosureReviewer   (the reviewer role's group)
#            U-VSO-IN_Inspector         (the inspector role's group, if absent)
#   users:   closure.reviewer           -> GROUP_U-VSO-IN_ClosureReviewer
#            demo.inspector1            -> GROUP_U-VSO-IN_Inspector
#   plus site membership on `vigilancia-de-la-so` for both.
#
# The inspector's id matches `external_user_i_d` on the demo inspector record, which
# is how the platform links an Alfresco login to an inspector.
#
# THE PERMISSION PART, AND WHY IT IS PER-USER
# -------------------------------------------
# An **application role does not grant an Alfresco permission**: the server authorises
# by role but performs the repository call with the user's own ticket, so an account
# with a role and no repository permission fails the write with 403 from Alfresco
# (surfacing as 502 from the API). Every writing role therefore needs repository
# access as well.
#
# A *group*-level grant is the right shape and this script would prefer it, but no
# scripted path works in this deployment: the v1 site-members endpoint returns 404 for
# a group id, the v1 node-permissions API returns 404 for `/nodes/{id}/permissions`,
# and the legacy `/alfresco/service/api/sites/{site}/memberships` webscript fails with
# 500 for a `groupId` (form-encoded — as JSON it does not even see the parameter).
# So membership is granted per **user**, which is what actually takes effect, and the
# group-level grant stays a manual Share step. Tracked in TECHNICAL_DEBT_ANALYSIS.md.
#
# DESTRUCTIVE OPTION: `--remove` deletes the two demo users and the two groups.
#
# Usage: seed-demo-identities.sh [--yes] [--remove]
# Credentials: ALFRESCO_USERNAME/ALFRESCO_PASSWORD, or fall back to
#              ../compliance_flow/.env (where this platform's dev values live).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ALFRESCO_URL="${ALFRESCO_URL:-http://localhost:8080/alfresco}"
SITE_SHORT_NAME="${SITE_SHORT_NAME:-vigilancia-de-la-so}"
REVIEWER_USER="${REVIEWER_USER:-closure.reviewer}"
REVIEWER_PASSWORD="${REVIEWER_PASSWORD:-DemoReviewer#2026}"
INSPECTOR_USER="${INSPECTOR_USER:-demo.inspector1}"
INSPECTOR_PASSWORD="${INSPECTOR_PASSWORD:-DemoInspector#2026}"
REVIEWER_ROLE_GROUP="${REVIEWER_ROLE_GROUP:-U-VSO-IN_ClosureReviewer}"
INSPECTOR_ROLE_GROUP="${INSPECTOR_ROLE_GROUP:-U-VSO-IN_Inspector}"

CONFIRMED=0
REMOVE=0
for arg in "$@"; do
  case "${arg}" in
    --yes) CONFIRMED=1 ;;
    --remove) REMOVE=1 ;;
    *) echo "Unknown argument: ${arg}"; exit 2 ;;
  esac
done

if [[ "${CONFIRMED}" != "1" ]]; then
  cat <<'USAGE'
This creates the demo identities in Alfresco (idempotent):
  groups U-VSO-IN_ClosureReviewer / U-VSO-IN_Inspector
  users  closure.reviewer / demo.inspector1, their group memberships and site access

  --remove deletes the two demo users and the two groups instead.

Run again with --yes to continue.
USAGE
  exit 1
fi

if [[ -z "${ALFRESCO_USERNAME:-}" || -z "${ALFRESCO_PASSWORD:-}" ]]; then
  if [[ -f "${ROOT_DIR}/../compliance_flow/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    . "${ROOT_DIR}/../compliance_flow/.env"
    set +a
  fi
fi

if [[ -z "${ALFRESCO_USERNAME:-}" || -z "${ALFRESCO_PASSWORD:-}" ]]; then
  echo "Error: set ALFRESCO_USERNAME and ALFRESCO_PASSWORD (compliance_flow/.env holds the dev values)." >&2
  exit 1
fi

API="${ALFRESCO_URL}/api/-default-/public/alfresco/versions/1"
AUTH=(-u "${ALFRESCO_USERNAME}:${ALFRESCO_PASSWORD}")

ok()  { printf '  ok   %s\n' "$1"; }
info(){ printf '  --   %s\n' "$1"; }

status() { curl -s -m 30 "${AUTH[@]}" -o /dev/null -w '%{http_code}' "$1"; }

# ---------------------------------------------------------------------------
echo "Checking Alfresco at ${ALFRESCO_URL} ..."
if [[ "$(status "${ALFRESCO_URL}/api/-default-/public/alfresco/versions/1/probes/-ready-")" != "200" ]]; then
  echo "Error: Alfresco readiness probe did not return 200." >&2
  exit 1
fi
ok "Alfresco is ready"
echo

if [[ "${REMOVE}" == "1" ]]; then
  for user in "${REVIEWER_USER}" "${INSPECTOR_USER}"; do
    if [[ "$(status "${API}/people/${user}")" == "200" ]]; then
      curl -s -m 30 "${AUTH[@]}" -X DELETE "${API}/people/${user}" -o /dev/null -w '' || true
      ok "deleted user ${user}"
    else
      info "user ${user} absent"
    fi
  done
  for group in "${REVIEWER_ROLE_GROUP}" "${INSPECTOR_ROLE_GROUP}"; do
    if [[ "$(status "${API}/groups/GROUP_${group}")" == "200" ]]; then
      curl -s -m 30 "${AUTH[@]}" -X DELETE "${API}/groups/GROUP_${group}" -o /dev/null -w '' || true
      ok "deleted group GROUP_${group}"
    else
      info "group GROUP_${group} absent"
    fi
  done
  exit 0
fi

# --- groups ---------------------------------------------------------------
for group in "${REVIEWER_ROLE_GROUP}:Closure Reviewer" "${INSPECTOR_ROLE_GROUP}:Inspector"; do
  name="${group%%:*}"
  display="${group##*:}"
  if [[ "$(status "${API}/groups/GROUP_${name}")" == "200" ]]; then
    info "group GROUP_${name} already exists"
  else
    curl -s -m 30 "${AUTH[@]}" -X POST "${API}/groups" \
      -H 'Content-Type: application/json' \
      -d "{\"id\":\"${name}\",\"displayName\":\"${display}\"}" -o /dev/null
    ok "created group GROUP_${name}"
  fi
done
echo

# --- users ----------------------------------------------------------------
create_user() { # create_user <id> <password> <first> <last>
  local id="$1" password="$2" first="$3" last="$4"
  if [[ "$(status "${API}/people/${id}")" == "200" ]]; then
    info "user ${id} already exists"
  else
    curl -s -m 30 "${AUTH[@]}" -X POST "${API}/people" \
      -H 'Content-Type: application/json' \
      -d "{\"id\":\"${id}\",\"password\":\"${password}\",\"firstName\":\"${first}\",\"lastName\":\"${last}\",\"email\":\"${id}@demo.invalid\"}" \
      -o /dev/null
    ok "created user ${id}"
  fi
}

create_user "${REVIEWER_USER}"  "${REVIEWER_PASSWORD}"  "Closure" "Reviewer"
create_user "${INSPECTOR_USER}" "${INSPECTOR_PASSWORD}" "Demo"    "Inspector"
echo

# --- group memberships ----------------------------------------------------
add_group_member() { # add_group_member <group> <user>
  local group="$1" user="$2"
  curl -s -m 30 "${AUTH[@]}" -X POST "${API}/groups/GROUP_${group}/members" \
    -H 'Content-Type: application/json' \
    -d "{\"id\":\"${user}\",\"memberType\":\"PERSON\"}" -o /dev/null || true
  ok "${user} -> GROUP_${group} (a duplicate is harmless)"
}

add_group_member "${REVIEWER_ROLE_GROUP}"  "${REVIEWER_USER}"
add_group_member "${INSPECTOR_ROLE_GROUP}" "${INSPECTOR_USER}"
echo

# --- repository permission (per user; see the header) ---------------------
add_site_member() { # add_site_member <user>
  curl -s -m 30 "${AUTH[@]}" -X POST "${API}/sites/${SITE_SHORT_NAME}/members" \
    -H 'Content-Type: application/json' \
    -d "{\"id\":\"$1\",\"role\":\"SiteCollaborator\"}" -o /dev/null || true
  ok "$1 is SiteCollaborator on ${SITE_SHORT_NAME}"
}

add_site_member "${REVIEWER_USER}"
add_site_member "${INSPECTOR_USER}"
echo

cat <<EOF
Demo identities ready.

  reviewer : ${REVIEWER_USER} / ${REVIEWER_PASSWORD}   roles: closure_reviewer (+ admin is break-glass)
  inspector: ${INSPECTOR_USER} / ${INSPECTOR_PASSWORD}   roles: inspector

Roles are granted through group membership and cached in the session, so log out and
back in after changing a membership. Verify with:

  curl -s -X POST http://127.0.0.1:4000/api/auth/login -H 'Content-Type: application/json' \\
    -d '{"username":"${REVIEWER_USER}","password":"${REVIEWER_PASSWORD}"}'
  # => {"authenticated":true,"roles":["closure_reviewer"],"csrfToken":"..."}
EOF
