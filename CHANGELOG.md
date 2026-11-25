# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- One-click **rollback**: the rail offers to flip back to the previous healthy
  release, and the deployer exposes `POST /rollback`.
- "Unpublished changes" indicator: the rail knows when files on disk are newer
  than the release that is live.
- Editor: side-by-side live preview, formatting toolbar and shortcuts,
  paste/drop image upload, unsaved-changes guard, Ctrl/⌘+S, word count.
- Post list: search and published/draft filter.
- Light theme (follows the OS), mobile layout, accessible dialogs and status
  announcements.
- Uploaded images now show in the editor preview before a deploy.
- Login rate limiting, origin check (CSRF) on every state-changing request,
  Content Security Policy and hardening headers.
- Unit tests for the admin (Vitest) and the deployer pipeline (`node --test`);
  CI runs typecheck, tests, builds, and infra validation. Dependabot config.

### Changed

- Admin and deployer migrated to strict TypeScript. The deployer runs its
  sources directly on Node 24 with no build step.
- Live-color state moved from the git working tree
  (`caddy/upstream/active.caddy`) to a Docker volume owned by the deployer.
- The admin port is published on `127.0.0.1` by default (`ADMIN_BIND`).
- `setup.sh` generates the admin password, works without `openssl`, and
  restricts `.env` to the owner.
- The deployer mounts the stack read-only and prunes dangling images after a
  successful deploy.
- Dependencies are installed from lockfiles (`npm ci`).

### Fixed

- **The blue-green flip could not work**: the Caddyfile had `admin off`, which
  disables the API `caddy reload` depends on. The admin API is now enabled on
  loopback inside the Caddy container only.
- A failed Caddy reload left the recorded live color out of sync with what
  Caddy was serving, so the next deploy would rebuild the live container.
- A new build answering 404 was considered healthy; health probes could hang
  forever without a timeout.
- Saving a post dropped every frontmatter field the admin does not edit
  (`authors`, `images`, `layout`, `canonicalUrl`, ...).
- Unquoted YAML dates showed up as garbage (`Wed Jan 31`) in the admin.
- `PUT /api/posts/<slug>` created posts that did not exist.
- `setup.sh` was not executable.

### Security

- Services refuse to start with placeholder or short `SESSION_SECRET` /
  `DEPLOY_TOKEN`, and refuse to seed a placeholder or short admin password.
- Markdown preview is sanitized (it previously injected raw HTML from post
  files into the admin origin).
- Uploads are validated by content and size limited; SVG uploads are rejected.
- Login no longer leaks whether an email exists through response timing.
- Internal error messages (filesystem paths) are no longer returned to clients.
- The deployer compares its token in constant time.

See "Upgrading from 0.1.0" in the README.

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
