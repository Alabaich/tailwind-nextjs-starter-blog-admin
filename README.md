# Blue-Green Admin for Tailwind Nextjs Starter Blog

[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/ci.yml)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![Docker Compose](https://img.shields.io/badge/deploy-docker%20compose-2496ED?logo=docker&logoColor=white)](docker-compose.yml)

A self-hosted admin panel and zero-downtime publishing pipeline for
[timlrx/tailwind-nextjs-starter-blog](https://github.com/timlrx/tailwind-nextjs-starter-blog) —
without forking it.

The starter is the most feature-rich Next.js markdown blog template out there:
SEO, sitemaps, RSS, MDX, perfect Lighthouse scores. Its one gap is that
publishing means editing `.mdx` files and pushing to git. This overlay adds the
missing piece: a login-protected admin where a non-technical author writes a
post, presses **Deploy**, and the site rebuilds behind the scenes with
**blue-green container swaps** — the live site never goes down, the new post
simply appears a minute or two later.

```
                 ┌───────────┐   writes .mdx    ┌──────────────────┐
   author ──────▶│   admin   │─────────────────▶│  site/data/blog  │
                 │  (:8081)  │                  └──────────────────┘
                 └─────┬─────┘                            │ build context
                       │ POST /rebuild                    ▼
                 ┌─────▼─────┐  docker build     ┌────────────────────┐
                 │  deployer │──────────────────▶│ blog-blue / green  │
                 └─────┬─────┘   healthcheck     └────────┬───────────┘
                       │ flip upstream + reload           │
                 ┌─────▼────────────────────────┐         │
   readers ─────▶│           caddy (:80)        │◀────────┘
                 └──────────────────────────────┘
```

## Design principles

- **The starter stays stock.** `setup.sh` clones upstream into `./site/` and
  adds exactly two files: a `Dockerfile` and a `.dockerignore`. No theme
  changes, no schema changes, no fork. `git pull` inside `site/` keeps you on
  upstream.
- **Files are the source of truth.** The admin writes plain `.mdx` with the
  starter's own frontmatter (`title`, `date`, `tags`, `draft`, `summary`). No
  database for content — you can stop using this overlay tomorrow and your blog
  still works.
- **Immutable deploys.** Content is baked into the image at build time. The
  inactive color is built, health-checked, then Caddy's upstream is flipped
  with a graceful reload. The previous color keeps running for instant
  rollback.
- **Failed builds are non-events.** If a build breaks, the live site keeps
  serving traffic and the admin shows the build log.
- **Least privilege.** Only the deployer holds the Docker socket. The admin
  talks to it over the internal network with a shared token.

## Quickstart

Requirements: Docker with Compose v2 and BuildKit (any recent Docker).

```bash
git clone <this-repo> && cd <this-repo>
./setup.sh                    # clones the starter, generates secrets
$EDITOR .env                  # set ADMIN_EMAIL and ADMIN_PASSWORD
docker compose up -d --build  # first build takes a few minutes
```

- Blog: `http://localhost:8080`
- Admin: `http://localhost:8081`

Write a post, press **Save**, then **Deploy** in the top rail. The rail shows
which color is live, the build state, and the log.

## How a deploy works

1. Admin saves the post to `site/data/blog/<slug>.mdx` (bind-mounted).
2. Admin calls the deployer's `POST /rebuild`.
3. Deployer builds the **inactive** color. The Dockerfile caches the dependency
   layer and persists `.next/cache` via a BuildKit cache mount, so rebuilds
   after a new post are fast.
4. Deployer starts the new container and polls it until healthy.
5. Deployer rewrites `caddy/upstream/active.caddy` and gracefully reloads
   Caddy. Traffic flips with zero downtime.
6. The old color stays up until the next deploy — rollback is flipping one file
   back and reloading Caddy.

Rebuild requests that arrive mid-build are coalesced into a single follow-up
run, so saving three posts in a row costs one extra build, not three.

## Production notes

- Point your domain at the host and edit `caddy/Caddyfile` to use it — Caddy
  will handle TLS automatically. Put the admin on a separate hostname and
  consider restricting it by IP.
- `COMPOSE_PROJECT_NAME` in `.env` must not change after first boot — the
  deployer relies on it to address the stack from inside its container.
- Old images accumulate over time; run `docker image prune -f` occasionally or
  add it to cron.

## Content history

Every save, delete, and image upload creates a local git commit inside
`site/` (authored as `blog-admin`), so a fat-fingered save or delete is never
final:

```bash
cd site
git log --oneline -- data/blog          # what changed and when
git show HEAD~1:data/blog/my-post.mdx   # read an older version
git checkout HEAD~1 -- data/blog/my-post.mdx  # restore it, then Deploy
```

History is best-effort by design: if git is unavailable the save still goes
through, it just isn't recorded.

## Updating the starter

```bash
cd site && git pull --rebase
```

Your content commits are local, so a rebase replays them on top of upstream.
Content lives in `site/data/blog/` and uploads in
`site/public/static/images/uploads/` — upstream rarely touches those paths.
After pulling, press **Deploy** to rebuild on the new version.

## Roadmap

- Multi-user accounts and roles
- Author and page (about/projects) editing
- One-click rollback button in the rail

## Contributing

Bug reports, feature requests, and PRs are welcome — see
[CONTRIBUTING.md](CONTRIBUTING.md). This project follows the [Contributor
Covenant](CODE_OF_CONDUCT.md).

## Security

Found a vulnerability? Please don't open a public issue — see
[SECURITY.md](SECURITY.md) for how to report it privately.

## Credits

Built on top of [timlrx/tailwind-nextjs-starter-blog](https://github.com/timlrx/tailwind-nextjs-starter-blog),
without which this project wouldn't have a blog to publish to. The SEO,
sitemap, RSS, and MDX work is all upstream's — this repo only adds the admin
and the deploy pipeline around it.

## License

[MIT](LICENSE) © Oleksandr Tsybulskyi
