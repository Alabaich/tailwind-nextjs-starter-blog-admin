# Security Policy

## Supported versions

There are no long-term-support branches — `main` is the only supported
version. Please confirm you're on the latest commit before reporting an
issue.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, report it privately through GitHub:

**[Report a vulnerability](https://github.com/Alabaich/tailwind-nextjs-starter-blog-admin/security/advisories/new)**

(or open the repository's **Security** tab and click **Report a
vulnerability**). The report is visible only to the maintainers.

We'll acknowledge reports within a few days and keep you updated while we
investigate and fix.

## Scope and threat model

This is a self-hosted admin panel, meant to run behind infrastructure you
control — it is not built for multi-tenant or public-signup use.

**What is defended**

- **Login.** One account, bcrypt-hashed (cost 12), seeded from env vars on
  first boot. Failed attempts are limited to 10 per client IP per 15 minutes.
  Unknown emails and wrong passwords cost the same bcrypt comparison and
  return the same message. Placeholder or short (< 12 characters) passwords are refused when
  the account is created.
- **Sessions.** Stateless HMAC-SHA256 signed cookies: `HttpOnly`,
  `SameSite=Lax`, `Secure` when the request arrived over HTTPS. The services
  refuse to start if `SESSION_SECRET` is a placeholder or shorter than 32
  characters. Rotating it invalidates all sessions.
- **CSRF.** Every non-GET request, including login, must carry an `Origin`
  matching the admin's own host and port. `SameSite` alone is not relied on
  because the blog and the admin share a site (same host, different port).
- **Path traversal.** Slugs are validated against a strict pattern before they
  touch the filesystem; upload names are generated server-side.
- **Uploads.** Images are identified by magic bytes (PNG, JPEG, GIF, WebP,
  AVIF) regardless of filename or declared type, and limited in size (8 MB by
  default, plus a 25 MB hard cap in Caddy). SVG is rejected because it is a
  script-capable document that would be served from the blog's origin.
- **XSS.** The markdown preview is sanitized with DOMPurify before it is
  rendered. The admin sends a Content Security Policy, `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff` and a same-origin referrer policy.
- **Error handling.** Only validation messages reach the client; unexpected
  errors are logged server-side and returned as a generic 500.
- **Deployer.** The only service holding the Docker socket. It is not
  published on any host port, compares `DEPLOY_TOKEN` in constant time, mounts
  the stack read-only, and only ever runs fixed `docker compose` commands — no
  request data reaches a command line.

**What you are responsible for**

- The bundled Caddyfile serves the admin over plain HTTP, so compose publishes
  it on `127.0.0.1` only. Use an SSH tunnel or put it behind TLS before
  exposing it (see the README's "Production notes").
- `DEPLOY_TOKEN` lets its holder trigger builds and rollbacks from inside the
  Docker network. Keep it secret and never publish the deployer's port. The
  Docker socket is the larger trust boundary: a compromised deployer
  container is a compromised host.
- Whoever can log in to the admin can publish arbitrary content, including
  MDX, which is code that runs at build time inside the blog image build.
  Treat admin access as publishing *and* build access.

**Known limitations**

- The Content Security Policy allows inline scripts (`'unsafe-inline'`),
  which Next.js needs without per-request nonces. It still blocks third-party
  script origins, framing, and plugin content.
- Sessions cannot be revoked individually; a copied cookie is valid until it
  expires (7 days) or `SESSION_SECRET` is rotated.
- The login rate limit is per IP and in memory: it resets on restart and does
  not stop a slow attack spread across many addresses. Use a strong password.

Reports involving auth bypass, escalation from the admin container to the
host, or leaking `DEPLOY_TOKEN`/`SESSION_SECRET` are all in scope, even if
they require local or internal-network access to demonstrate.
