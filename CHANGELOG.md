# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.1.0] - 2026-07-11

### Added

- Login-protected admin panel for `timlrx/tailwind-nextjs-starter-blog`,
  without forking it.
- Blue-green zero-downtime deploy pipeline: Caddy + a token-authenticated
  deployer service that builds the inactive color, health-checks it, and
  flips traffic with a graceful reload.
- Post editor with markdown preview, tag/draft/summary fields, and image
  upload.
- Local git commit on every save, delete, and upload inside `site/` —
  free content history and undo.
- One-command setup via `setup.sh` (clones the starter, generates secrets).
