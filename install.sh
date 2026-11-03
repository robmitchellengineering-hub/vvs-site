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

VERSION="${VALIANT_VERSION:-0.16.0}"
BASE="${VALIANT_BASE:-https://vvs.morpheus.nz}"
TARBALL="${BASE}/downloads/valiant-verification-sdk-${VERSION}.tgz"
TRIAL="${BASE}/downloads/trial-2026-11.licence"
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
if "${VALIANT}" licence --status 2>/dev/null | grep -q "licence OK"; then
  say "     this machine already has one:"
  "${VALIANT}" licence --status | sed 's/^/     /'
else
  tmp="$(mktemp)"
  if curl -fsSL "$TRIAL" -o "$tmp" 2>/dev/null; then
    "${VALIANT}" licence --file "$tmp" | sed 's/^/     /'
    rm -f "$tmp"
  else
    say "     no trial licence reachable — run: valiant licence --file <your licence>"
  fi
fi

say "3/3  done"
cat <<'NEXT'

  next:  cd into a repository and run

             valiant setup     # writes valiant.json, proposes a guard, runs the gate

         or, if you want the pieces:  valiant init → valiant mutate → valiant gate

  the trial lasts 14 days; licences and renewal: https://vvs.morpheus.nz/install.html
NEXT
