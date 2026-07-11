# Contributing

Thanks for considering a contribution. This project stays deliberately small —
before adding something, check whether it fits the [design
principles](README.md#design-principles) in the README: the starter stays
unforked, files are the source of truth, deploys stay immutable and
least-privilege. Changes that fight those principles are a harder sell than
changes that work within them.

## Dev setup

```bash
git clone https://github.com/OWNER/REPO.git
cd REPO
./setup.sh
$EDITOR .env
docker compose up -d --build
```

Blog: http://localhost:8080 · Admin: http://localhost:8081

Most changes live in one of three places:

- `admin/` — the Next.js CMS (post editor, auth, API routes)
- `deployer/` — the blue-green build/swap pipeline
- `caddy/`, `docker-compose.yml`, `setup.sh` — the infrastructure glue

## Making a change

1. For anything beyond a small fix, open an issue first so we can agree on
   the approach before you write code.
2. Keep the diff focused — one change per PR.
3. Test it for real: `docker compose up -d --build`, then walk through the
   flow you touched (save a post, press Deploy, check the log, confirm the
   color actually flips).
4. Update the README if you changed setup steps, env vars, or behavior it
   documents.

## Pull requests

- Describe what changed and why, not just what.
- Link the issue it resolves, if any.
- Small, reviewable PRs get merged faster than large ones.

## Reporting bugs / requesting features

Use the issue templates. For security issues, see
[SECURITY.md](SECURITY.md) instead of opening a public issue.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
