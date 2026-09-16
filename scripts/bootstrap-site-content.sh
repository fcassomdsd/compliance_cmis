#!/usr/bin/env bash
#
# bootstrap-site-content.sh — create the Alfresco site, its folder tree and the document templates
# a fresh instance needs before this platform can import or generate anything.
#
# Why this exists: every path the webscripts resolve lives under one Share site
# (`webscripts/common/vso-paths.lib.js`), and the templates they render are files in that site:
#
#   Sites/vigilancia-de-la-so/documentLibrary/Vigilancia/Inspecciones     (canonical documents)
#   Sites/vigilancia-de-la-so/documentLibrary/Vigilancia/Datos de campo   (field-collection source)
#   Sites/vigilancia-de-la-so/documentLibrary/Vigilancia/Hallazgos        (findings)
#   Sites/vigilancia-de-la-so/documentLibrary/Vigilancia/Template data    (generation staging)
#   Sites/vigilancia-de-la-so/documentLibrary/Documentos/Formatos/*.fodt  (the five templates)
#
# A provisioned instance has all of it because somebody created it by hand in Share. Nothing
# tracked did, so a clean clone came up, installed, seeded and logged in — and then failed on its
# first canonical import with:
#
#   Destination base folder not found: Sites/vigilancia-de-la-so/documentLibrary/Vigilancia/Inspecciones
#
# This is the tracked version of that step, the Alfresco half of what tracking `metadata/` did for
# AtroCore. The five `.fodt` templates are already in this repository (`templates/`) — they were
# only ever installed by hand.
#
# Idempotent: creates what is missing, leaves everything else alone, and can be re-run.
#
# Usage: bootstrap-site-content.sh [--yes]
# Credentials: ALFRESCO_USERNAME/ALFRESCO_PASSWORD, or fall back to
#              ../compliance_flow/.env (where this platform's dev values live).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ALFRESCO_URL="${ALFRESCO_URL:-http://localhost:8080/alfresco}"
SITE_SHORT_NAME="${SITE_SHORT_NAME:-vigilancia-de-la-so}"
SITE_TITLE="${SITE_TITLE:-Vigilancia de la Seguridad Operacional}"

CONFIRMED=0
for arg in "$@"; do
  case "${arg}" in
    --yes) CONFIRMED=1 ;;
    *) echo "Unknown argument: ${arg}"; exit 2 ;;
  esac
done

if [[ "${CONFIRMED}" != "1" ]]; then
  cat <<USAGE
This will, in ${ALFRESCO_URL}:
  * create the site '${SITE_SHORT_NAME}' if it does not exist (a private site with a document library)
  * create documentLibrary/Vigilancia/{Inspecciones,Datos de campo,Hallazgos,Template data}
  * create documentLibrary/Documentos/Formatos
  * upload the five .fodt templates from this repository's templates/ into Documentos/Formatos

It creates only what is missing, so re-running it is safe.
Run again with --yes to continue.
USAGE
  exit 1
fi

# --- credentials (same convention as seed-demo-identities.sh) --------------------------------
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

API="${ALFRESCO_URL%/}/api/-default-/public/alfresco/versions/1"
AUTH=(-u "${ALFRESCO_USERNAME}:${ALFRESCO_PASSWORD}")

say() { printf '    %s\n' "$1"; }
fail() { printf 'Error: %s\n' "$1" >&2; exit 1; }

# `node` is a documented host prerequisite for this platform's scripts (runbook §1.1).
json_field() { # json_field <expression over `d`>, JSON on stdin
  node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const d=JSON.parse(s);const v=new Function("d","return ("+process.argv[1]+")")(d);console.log(v===undefined||v===null?"":v)}catch(e){console.log("")}})' "$1"
}

node_id() { # node_id <path relative to Company Home> -> id, or empty
  local encoded
  encoded=$(node -e 'console.log(encodeURIComponent(process.argv[1]))' "$1")
  curl -s -m 30 "${AUTH[@]}" "${API}/nodes/-root-?relativePath=${encoded}" | json_field 'd.entry && d.entry.id'
}

child_id() { # child_id <parent id> <name> -> id, or empty
  # The v1 children endpoint has no name filter, so the (small) child list is filtered here.
  curl -s -m 30 "${AUTH[@]}" "${API}/nodes/$1/children?maxItems=1000" \
    | CHILD_NAME="$2" node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const d=JSON.parse(s);const hit=((d.list||{}).entries||[]).find(e=>e.entry.name===process.env.CHILD_NAME);console.log(hit?hit.entry.id:"")}catch(e){console.log("")}})'
}

status() { curl -s -m 30 "${AUTH[@]}" -o /dev/null -w '%{http_code}' "$1"; }

# --- 1. the site ------------------------------------------------------------------------------
site_code="$(status "${API}/sites/${SITE_SHORT_NAME}")"
if [[ "${site_code}" == "200" ]]; then
  say "site ${SITE_SHORT_NAME} already exists"
else
  created="$(curl -s -m 60 "${AUTH[@]}" -H 'Content-Type: application/json' -X POST "${API}/sites" \
    -d "$(node -e 'console.log(JSON.stringify({id: process.argv[1], title: process.argv[2], visibility: "PRIVATE"}))' "${SITE_SHORT_NAME}" "${SITE_TITLE}")")"
  # No `preset`: ACS rejects it ("Site preset should not be set" — the property is deprecated), and
  # a site gets its documentLibrary either way.
  [[ -n "$(printf '%s' "${created}" | json_field 'd.entry && d.entry.id')" ]] \
    || fail "could not create the site ${SITE_SHORT_NAME}: $(printf '%s' "${created}" | head -c 200)"
  say "site ${SITE_SHORT_NAME} created"
fi

document_library="$(node_id "Sites/${SITE_SHORT_NAME}/documentLibrary")"
[[ -n "${document_library}" ]] || fail "the site has no documentLibrary — did the site creation fail?"
say "documentLibrary ${document_library}"

# --- 2. the folder tree -----------------------------------------------------------------------
ensure_folder() { # ensure_folder <parent id> <name> -> prints the id
  local existing
  existing="$(child_id "$1" "$2")"
  if [[ -n "${existing}" ]]; then
    printf '%s' "${existing}"
    return 0
  fi
  local created
  created="$(curl -s -m 60 "${AUTH[@]}" -H 'Content-Type: application/json' -X POST "${API}/nodes/$1/children" \
    -d "$(node -e 'console.log(JSON.stringify({name: process.argv[1], nodeType: "cm:folder"}))' "$2")")"
  existing="$(printf '%s' "${created}" | json_field 'd.entry && d.entry.id')"
  [[ -n "${existing}" ]] || fail "could not create folder '$2' under $1: $(printf '%s' "${created}" | head -c 200)"
  printf '%s' "${existing}"
}

vigilancia="$(ensure_folder "${document_library}" "Vigilancia")"
say "Vigilancia ${vigilancia}"
for folder in "Inspecciones" "Datos de campo" "Hallazgos" "Template data"; do
  id="$(ensure_folder "${vigilancia}" "${folder}")"
  say "Vigilancia/${folder} ${id}"
done

documentos="$(ensure_folder "${document_library}" "Documentos")"
formatos="$(ensure_folder "${documentos}" "Formatos")"
say "Documentos/Formatos ${formatos}"

# --- 3. the templates -------------------------------------------------------------------------
TEMPLATES=(
  "formato plan de inspeccion.fodt"
  "Informe Final.fodt"
  "Checklist Reporte.fodt"
  "Finding Reporte.fodt"
  "FollowUp Reporte.fodt"
)

for template in "${TEMPLATES[@]}"; do
  source_file="${ROOT_DIR}/templates/${template}"
  [[ -f "${source_file}" ]] || fail "missing template in this repository: templates/${template}"
  if [[ -n "$(child_id "${formatos}" "${template}")" ]]; then
    say "Documentos/Formatos/${template} already present"
    continue
  fi
  uploaded="$(curl -s -m 120 "${AUTH[@]}" -X POST "${API}/nodes/${formatos}/children" \
    -F "name=${template}" \
    -F "filedata=@${source_file};type=application/vnd.oasis.opendocument.text")"
  [[ -n "$(printf '%s' "${uploaded}" | json_field 'd.entry && d.entry.id')" ]] \
    || fail "could not upload ${template}: $(printf '%s' "${uploaded}" | head -c 200)"
  say "Documentos/Formatos/${template} uploaded"
done

printf '\nbootstrap-site-content: %s is ready\n' "${SITE_SHORT_NAME}"
