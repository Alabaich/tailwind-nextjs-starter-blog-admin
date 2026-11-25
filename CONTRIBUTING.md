# Contributing

Thanks for considering a contribution. This project stays deliberately small —
before adding something, check whether it fits the [design
principles](README.md#design-principles) in the README: the starter stays
unforked, files are the source of truth, deploys stay immutable and
least-privilege. Changes that fight those principles are a harder sell than
changes that work within them.

## Dev setup

```bash
git clone https://github.com/Alabaich/tailwind-nextjs-starter-blog-admin.git
cd tailwind-nextjs-starter-blog-admin
./setup.sh
$EDITOR .env
docker compose up -d --build
```

Blog: http://localhost:8080 · Admin: http://localhost:8081

Most changes live in one of three places:

- `admin/` — the Next.js CMS (post editor, auth, API routes), TypeScript
- `deployer/` — the blue-green build/swap/rollback pipeline, TypeScript run
  directly by Node
- `caddy/`, `docker-compose.yml`, `setup.sh` — the infrastructure glue

## Checks

CI runs these on every PR; run them locally first:

```bash
cd admin    && npm ci && npm run typecheck && npm test && npm run build
cd deployer && npm ci && npm run typecheck && npm test
```

Neither test suite needs Docker. The deployer's pipeline takes docker, HTTP
probes, files and the clock as injected dependencies, so a new pipeline
behavior should come with a test in `deployer/test/pipeline.test.ts`.

To work on the admin UI without the full stack, run `npm run dev` in `admin/`
with `SESSION_SECRET`, `DEPLOY_TOKEN`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`,
`CONTENT_DIR`, `UPLOAD_DIR` and `DB_PATH` set to local values. Without a
deployer the rail shows "Deployer offline"; everything else works.

## Making a change

1. For anything beyond a small fix, open an issue first so we can agree on
   the approach before you write code.
2. Keep the diff focused — one change per PR.
3. Add or update tests for behavior you change, especially anything touching
   auth, input validation, or the deploy pipeline.
4. For pipeline or infrastructure changes, test it for real:
   `docker compose up -d --build`, then walk through the flow you touched
   (save a post, press Deploy, check the log, confirm the color actually
   flips, roll back).
5. Update the README if you changed setup steps, env vars, or behavior it
   documents, and add a line to `CHANGELOG.md`.

## Pull requests

- Describe what changed and why, not just what.
- Link the issue it resolves, if any.
- Small, reviewable PRs get merged faster than large ones.

## Reporting bugs / requesting features

Use the issue templates. For security issues, see
[SECURITY.md](SECURITY.md) instead of opening a public issue.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
