# Security Policy

## Supported versions

There are no long-term-support branches — `main` is the only supported
version. Please confirm you're on the latest commit before reporting an
issue.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead:

1. Go to the **Security** tab of this repository
2. Click **Report a vulnerability** (GitHub private vulnerability reporting)

Or email **[INSERT CONTACT EMAIL]** directly.

We'll acknowledge reports within a few days and keep you updated while we
investigate and fix.

## Scope and threat model

This is a self-hosted admin panel, meant to run behind infrastructure you
control — it is not built for multi-tenant or public-signup use.

- The admin panel has a single login (email + password, bcrypt-hashed,
  seeded from env vars). There is no rate limiting on `/api/login` — if you
  expose the admin port to the public internet, put it behind IP
  allowlisting or its own authenticated hostname (see the README's
  "Production notes").
- The `deployer` service holds the Docker socket. Its `DEPLOY_TOKEN` should
  be treated like a root credential — port 8000 must never be exposed
  outside the internal Docker network.
- `SESSION_SECRET` signs login sessions; rotating it invalidates all active
  sessions.

Reports involving auth bypass, escalation from the admin container to the
host, or leaking `DEPLOY_TOKEN`/`SESSION_SECRET` are all in scope, even if
they require local or internal-network access to demonstrate.
