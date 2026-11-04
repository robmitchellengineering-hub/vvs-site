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

VERSION="${VALIANT_VERSION:-0.16.1}"
BASE="${VALIANT_BASE:-https://vvs.morpheus.nz}"
REGISTRY="${VALIANT_REGISTRY:-https://api.morpheus.nz/api/functions/getPackage}"
MORPHEUS_APP="${MORPHEUS_APP:-https://morpheus.nz}"
BIN_DIR="${HOME}/.local/bin"

say() { printf '%s\n' "$*"; }
die() { printf 'valiant install: %s\n' "$*" >&2; exit 2; }

# THE LICENCE IS THE CREDENTIAL. The tarball used to be a public file on this site, so a purchase bought exactly what a
# visitor already had. It now comes from the registry, which verifies the licence — the same token `valiant gate` uses.
# (Rob, 2026-11-04: the download belongs to the process after purchasing, behind the account.)
LICENCE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --licence) LICENCE="$2"; shift 2 ;;
    --licence=*) LICENCE="${1#*=}"; shift ;;
    *) shift ;;
  esac
done
[ -n "$LICENCE" ] || LICENCE="${VALIANT_LICENCE:-}"

command -v node >/dev/null 2>&1 || die "Node 18+ is required (https://nodejs.org). Nothing was changed."
node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 18 ? 0 : 1)' \
  || die "Node 18+ is required; found $(node -v). Nothing was changed."

if [ -z "$LICENCE" ]; then
  say "A licence is required — the download is yours, not the public's."
  say ""
  say "  1. sign in (free 14-day trial, no card):  ${MORPHEUS_APP}/licences"
  say "  2. copy the licence it shows you, then run:"
  say ""
  say "     curl -fsSL ${BASE}/install.sh | sh -s -- --licence <token>"
  say ""
  die "no licence given, so nothing was installed"
fi

say "1/3  installing the valiant CLI (${VERSION})"
PKG="${REGISTRY}?name=valiant-verification-sdk&version=${VERSION}&licence=$(printf '%s' "$LICENCE" | sed 's/ /%20/g')"
if ! npm install -g --no-audit --no-fund "$PKG" >/tmp/valiant-install.log 2>&1; then
  say "     global install needs root here — installing under ~/.valiant/sdk instead"
  mkdir -p "${HOME}/.valiant/sdk" "${BIN_DIR}"
  npm install --prefix "${HOME}/.valiant/sdk" --no-audit --no-fund "$PKG" >>/tmp/valiant-install.log 2>&1 \
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
"${VALIANT}" licence "$LICENCE" | sed 's/^/     /'

say "3/3  done"
cat <<'NEXT'

  next:  cd into a repository and run

             valiant setup     # writes valiant.json, proposes a guard, runs the gate

         or, if you want the pieces:  valiant init → valiant mutate → valiant gate

  the trial lasts 14 days; licences and renewal: https://vvs.morpheus.nz/install.html
NEXT
