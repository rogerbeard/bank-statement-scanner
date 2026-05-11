#!/usr/bin/env bash
# =============================================================================
# Bank Statement Scanner — Automated Installer for macOS
# =============================================================================
# Usage:
#   bash install.sh                          # prompts for GitHub token
#   GITHUB_TOKEN=ghp_xxx bash install.sh     # non-interactive / CI mode
#
# What this script does:
#   1. Detects your Mac architecture (Apple Silicon or Intel)
#   2. Fetches the latest successful GitHub Actions build via the GitHub API
#   3. Downloads the correct .dmg artifact (arm64 or x64)
#   4. Mounts the DMG, copies the .app to /Applications, then unmounts
#   5. Removes the quarantine flag so macOS Gatekeeper doesn't block launch
#   6. Cleans up all temporary files
# =============================================================================

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
REPO_OWNER="rogerbeard"
REPO_NAME="bank-statement-scanner"
WORKFLOW_FILENAME="build-macos.yml"
ARTIFACT_NAME="Bank-Statement-Scanner-macOS"
APP_NAME="Bank Statement Scanner.app"
INSTALL_DIR="/Applications"
TMP_DIR="$(mktemp -d)"

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo -e "${BLUE}▶${RESET}  $*"; }
success() { echo -e "${GREEN}✔${RESET}  $*"; }
warn()    { echo -e "${YELLOW}⚠${RESET}  $*"; }
error()   { echo -e "${RED}✖${RESET}  $*" >&2; }
header()  { echo -e "\n${BOLD}$*${RESET}"; }

cleanup() {
  info "Cleaning up temporary files…"
  # Unmount any DMG that may still be mounted
  if [[ -n "${MOUNT_POINT:-}" ]] && mount | grep -q "$MOUNT_POINT"; then
    hdiutil detach "$MOUNT_POINT" -quiet 2>/dev/null || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║       Bank Statement Scanner — Automated Installer       ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════╝${RESET}"
echo ""

# ── Prerequisites check ───────────────────────────────────────────────────────
header "Step 1 of 5 — Checking prerequisites"

for cmd in curl jq unzip hdiutil; do
  if ! command -v "$cmd" &>/dev/null; then
    error "Required command not found: $cmd"
    if [[ "$cmd" == "jq" ]]; then
      echo "       Install it with: brew install jq"
    fi
    exit 1
  fi
done
success "All prerequisites satisfied (curl, jq, unzip, hdiutil)"

# ── Architecture detection ────────────────────────────────────────────────────
ARCH="$(uname -m)"
if [[ "$ARCH" == "arm64" ]]; then
  DMG_PATTERN="arm64.dmg"
  ARCH_LABEL="Apple Silicon (arm64)"
else
  DMG_PATTERN="x64.dmg"
  ARCH_LABEL="Intel (x64)"
fi
success "Detected architecture: ${ARCH_LABEL}"

# ── GitHub token ──────────────────────────────────────────────────────────────
header "Step 2 of 5 — GitHub authentication"

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo ""
  echo "  A GitHub Personal Access Token (classic) with the 'repo' scope"
  echo "  is required to download private build artifacts."
  echo ""
  echo "  Create one at: https://github.com/settings/tokens/new?scopes=repo"
  echo ""
  read -rsp "  Paste your GitHub token (input hidden): " GITHUB_TOKEN
  echo ""
fi

# Validate the token with a lightweight API call
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}")

if [[ "$HTTP_STATUS" != "200" ]]; then
  error "GitHub token validation failed (HTTP ${HTTP_STATUS})."
  error "Ensure the token has the 'repo' scope and the repository exists."
  exit 1
fi
success "GitHub token validated"

# ── Find latest successful workflow run ───────────────────────────────────────
header "Step 3 of 5 — Locating latest successful build"

info "Querying GitHub Actions API for latest successful run of '${WORKFLOW_FILENAME}'…"

RUNS_JSON=$(curl -s \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILENAME}/runs?status=success&per_page=5")

RUN_ID=$(echo "$RUNS_JSON" | jq -r '.workflow_runs[0].id // empty')
RUN_URL=$(echo "$RUNS_JSON" | jq -r '.workflow_runs[0].html_url // empty')
RUN_DATE=$(echo "$RUNS_JSON" | jq -r '.workflow_runs[0].created_at // empty')

if [[ -z "$RUN_ID" ]]; then
  error "No successful workflow runs found."
  error "Ensure the GitHub Actions build has completed successfully at:"
  error "  https://github.com/${REPO_OWNER}/${REPO_NAME}/actions"
  exit 1
fi

success "Found build run #${RUN_ID} (${RUN_DATE})"
info    "Build URL: ${RUN_URL}"

# ── Find and download the artifact ───────────────────────────────────────────
header "Step 4 of 5 — Downloading DMG artifact"

info "Fetching artifact list for run #${RUN_ID}…"

ARTIFACTS_JSON=$(curl -s \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/runs/${RUN_ID}/artifacts")

ARTIFACT_ID=$(echo "$ARTIFACTS_JSON" | jq -r \
  --arg name "$ARTIFACT_NAME" \
  '.artifacts[] | select(.name == $name) | .id // empty' | head -1)

if [[ -z "$ARTIFACT_ID" ]]; then
  error "Artifact '${ARTIFACT_NAME}' not found in run #${RUN_ID}."
  exit 1
fi

ARTIFACT_SIZE=$(echo "$ARTIFACTS_JSON" | jq -r \
  --arg name "$ARTIFACT_NAME" \
  '.artifacts[] | select(.name == $name) | .size_in_bytes // 0' | head -1)

ARTIFACT_SIZE_MB=$(( ARTIFACT_SIZE / 1024 / 1024 ))
success "Found artifact ID ${ARTIFACT_ID} (approx. ${ARTIFACT_SIZE_MB} MB)"

info "Downloading artifact ZIP (this may take a minute on slower connections)…"

ZIP_PATH="${TMP_DIR}/artifact.zip"

curl -L \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  --progress-bar \
  -o "$ZIP_PATH" \
  "https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/artifacts/${ARTIFACT_ID}/zip"

success "Download complete: $(du -sh "$ZIP_PATH" | cut -f1)"

info "Extracting ZIP…"
unzip -q "$ZIP_PATH" -d "${TMP_DIR}/extracted"

# Find the correct DMG for this architecture
DMG_PATH=$(find "${TMP_DIR}/extracted" -name "*${DMG_PATTERN}" | head -1)

if [[ -z "$DMG_PATH" ]]; then
  error "Could not find a DMG matching pattern '*${DMG_PATTERN}' in the artifact."
  error "Available files:"
  find "${TMP_DIR}/extracted" -type f | sed 's/^/    /'
  exit 1
fi

DMG_FILENAME="$(basename "$DMG_PATH")"
success "Selected DMG: ${DMG_FILENAME}"

# ── Mount, copy, unmount ──────────────────────────────────────────────────────
header "Step 5 of 5 — Installing to ${INSTALL_DIR}"

info "Mounting DMG…"
MOUNT_OUTPUT=$(hdiutil attach "$DMG_PATH" -nobrowse -noautoopen -quiet 2>&1)
MOUNT_POINT=$(echo "$MOUNT_OUTPUT" | grep -E "^/dev/" | awk '{print $NF}' | tail -1)

if [[ -z "$MOUNT_POINT" ]]; then
  # Fallback: find the mounted volume by name
  MOUNT_POINT=$(find /Volumes -maxdepth 1 -name "Bank Statement*" 2>/dev/null | head -1)
fi

if [[ -z "$MOUNT_POINT" ]]; then
  error "Failed to determine DMG mount point."
  error "hdiutil output: ${MOUNT_OUTPUT}"
  exit 1
fi

success "DMG mounted at: ${MOUNT_POINT}"

# Find the .app bundle inside the mounted DMG
APP_SOURCE=$(find "$MOUNT_POINT" -maxdepth 2 -name "*.app" -type d | head -1)

if [[ -z "$APP_SOURCE" ]]; then
  error "No .app bundle found inside the DMG at ${MOUNT_POINT}"
  exit 1
fi

ACTUAL_APP_NAME="$(basename "$APP_SOURCE")"
DEST_PATH="${INSTALL_DIR}/${ACTUAL_APP_NAME}"

# Remove existing installation if present
if [[ -d "$DEST_PATH" ]]; then
  warn "Existing installation found at ${DEST_PATH} — replacing…"
  rm -rf "$DEST_PATH"
fi

info "Copying ${ACTUAL_APP_NAME} to ${INSTALL_DIR}…"
cp -R "$APP_SOURCE" "$DEST_PATH"

info "Unmounting DMG…"
hdiutil detach "$MOUNT_POINT" -quiet
MOUNT_POINT=""  # prevent double-unmount in cleanup

# ── Remove quarantine flag (bypass Gatekeeper for unsigned app) ───────────────
info "Removing macOS quarantine flag (allows launch without Gatekeeper prompt)…"
xattr -rd com.apple.quarantine "$DEST_PATH" 2>/dev/null || true

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${GREEN}${BOLD}║          Installation complete!                          ║${RESET}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════╝${RESET}"
echo ""
success "Installed: ${DEST_PATH}"
echo ""
echo "  Launch the app:"
echo "    open \"${DEST_PATH}\""
echo "  — or find it in Launchpad / Spotlight as '${ACTUAL_APP_NAME%.app}'"
echo ""

# Offer to launch immediately
read -rp "  Launch Bank Statement Scanner now? [Y/n] " LAUNCH_NOW
LAUNCH_NOW="${LAUNCH_NOW:-Y}"
if [[ "$LAUNCH_NOW" =~ ^[Yy]$ ]]; then
  open "$DEST_PATH"
  success "App launched!"
fi

echo ""
