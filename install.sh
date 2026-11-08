#!/bin/sh
# Valiant Verification SDK — install in one command.
#
#   curl -fsSL https://vvs.morpheus.nz/install.sh | sh
#
# What it does, in order, and nothing else:
#   1. checks Node 18 or newer (the SDK has one dependency: Node itself),
#   2. installs the `valiant` CLI (global, or ~/.valiant/sdk when global needs root),
#   3. installs a 14-day trial licence if this machine has none,
#   4. tells you the one command to run in your repository.
#
# It never asks for a password, never sends a prompt anywhere, and never edits your repository.
set -eu

VERSION="${VALIANT_VERSION:-latest}"
BASE="${VALIANT_BASE:-https://vvs.morpheus.nz}"
MORPHEUS_APP="${MORPHEUS_APP:-https://morpheus.nz}"
# A version is never typed here. "latest" resolves from the site's own index, so a new release cannot
# leave this installer handing out an old build (the same hardcoded-pin class that left a customer page on 0.2.0).
if [ "${VERSION}" = "latest" ]; then
  VERSION="$(curl -fsSL "${BASE}/downloads/index.json" 2>/dev/null | sed -n 's/.*"latest"[[:space:]]*:[[:space:]]*"\([0-9][0-9.]*\)".*/\1/p' | head -1)"
  [ -n "${VERSION}" ] || die "could not resolve the current build from ${BASE}/downloads/index.json"
fi
TARBALL="${BASE}/downloads/valiant-verification-sdk-${VERSION}.tgz"
BIN_DIR="${HOME}/.local/bin"

say() { printf '%s\n' "$*"; }
die() { printf 'valiant install: %s\n' "$*" >&2; exit 1; }

command -v node >/dev/null 2>&1 || die "Node 18+ is required (https://nodejs.org). Nothing was changed."
node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 18 ? 0 : 1)' \
  || die "Node 18+ is required; found $(node -v). Nothing was changed."

say "1/3  installing the valiant CLI (${VERSION})"
if ! npm install -g --no-audit --no-fund "$TARBALL" >/tmp/valiant-install.log 2>&1; then
  say "     global install needs root here — installing under ~/.valiant/sdk instead"
  mkdir -p "${HOME}/.valiant/sdk" "${BIN_DIR}"
  npm install --prefix "${HOME}/.valiant/sdk" --no-audit --no-fund "$TARBALL" >>/tmp/valiant-install.log 2>&1 \
    || { tail -20 /tmp/valiant-install.log >&2; die "install failed — the log is /tmp/valiant-install.log"; }
  ln -sf "${HOME}/.valiant/sdk/node_modules/.bin/valiant" "${BIN_DIR}/valiant"
  case ":${PATH}:" in *":${BIN_DIR}:"*) ;; *)
    say "     add this to your shell profile so 'valiant' is on PATH:"
    say "       export PATH=\"\$HOME/.local/bin:\$PATH\""
    PATH="${BIN_DIR}:${PATH}"; export PATH ;;
  esac
fi

VALIANT="$(command -v valiant || true)"
[ -n "${VALIANT}" ] || die "installed, but 'valiant' is not on PATH — see the export line above."

say "2/3  licence"
# A LICENCE IS ISSUED TO YOUR MORPHEUS ACCOUNT. The trial used to be a static file on this site — the same token for
# every visitor, unattributable and expiring for everyone on one date. It is now minted under the account, appears on
# /licences where it can be revoked, and does not depend on a file being republished. (Rob, 2026-11-04: "it needs a
# login to get the trial".)
if "${VALIANT}" licence --status 2>/dev/null | grep -q "licence OK"; then
  say "     this machine already has one:"
  "${VALIANT}" licence --status | sed 's/^/     /'
else
  say "     no licence on this machine yet."
  say "     get one (free 14-day trial) at:  ${MORPHEUS_APP}/licences"
  say "     then run:                        valiant licence <the token it shows you>"
fi

say "3/3  opening the control panel"
# The GUI is part of the install: it opens your browser to the control panel. It runs locally
# (nothing leaves this machine) and stops when you close the terminal or press Ctrl-C.
if command -v nohup >/dev/null 2>&1; then
  nohup "${VALIANT}" ui < /dev/null >/dev/null 2>&1 &
else
  "${VALIANT}" ui < /dev/null >/dev/null 2>&1 &
fi
say "     the control panel should now be open in your browser (http://localhost:8787)"

cat <<'NEXT'

  the panel is the human face of the SDK:
    - toggle enforcement on/off
    - watch the gate run live
    - the AI-control number (0 under control · 1 a control broke · 2 could not check), with yes/no ticks

  if the browser did not open, run:  valiant ui

  next, on a repository:  valiant setup     # writes valiant.json, proposes a guard, runs the gate

  the trial lasts 14 days; licences and renewal: https://vvs.morpheus.nz/install.html
NEXT
