#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Random hex string; works without openssl.
rand_hex() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$1"
  else
    od -An -N "$1" -tx1 /dev/urandom | tr -d ' \n'
  fi
}

# set_env KEY VALUE — replaces the KEY=... line in .env.
set_env() {
  sed -i.bak "s|^$1=.*|$1=$2|" .env
  rm -f .env.bak
}

# 1. Pull the upstream starter, unmodified. Kept as a git clone so you can
#    `git pull` upstream updates later — this overlay never forks it.
if [ ! -f site/package.json ]; then
  echo "Cloning timlrx/tailwind-nextjs-starter-blog into ./site ..."
  git clone --depth 1 https://github.com/timlrx/tailwind-nextjs-starter-blog.git site
else
  echo "./site already exists, skipping clone."
fi

# 2. The only files added inside site/: a Dockerfile and .dockerignore.
cp blog/Dockerfile site/Dockerfile
cp blog/.dockerignore site/.dockerignore

# 3. Make sure the uploads dir exists (mounted into the admin container).
mkdir -p site/public/static/images/uploads

# 4. Environment.
if [ ! -f .env ]; then
  cp .env.example .env
  chmod 600 .env
  admin_password="$(rand_hex 12)"
  set_env SESSION_SECRET "$(rand_hex 32)"
  set_env DEPLOY_TOKEN "$(rand_hex 32)"
  set_env ADMIN_PASSWORD "$admin_password"
  echo ""
  echo "Generated SESSION_SECRET, DEPLOY_TOKEN and an admin password in .env"
  echo "  admin password: $admin_password"
  echo "Now edit .env and set ADMIN_EMAIL (and your own password if you prefer)."
elif grep -Eq '^(SESSION_SECRET|DEPLOY_TOKEN)=replace-with-random-hex$|^ADMIN_PASSWORD=change-me$' .env; then
  echo ""
  echo "WARNING: .env still contains placeholder values. The services refuse to"
  echo "start with them — set real values (e.g. openssl rand -hex 32)."
fi

echo ""
echo "Next steps:"
echo "  docker compose up -d --build"
echo "  blog:  http://localhost:8080   (BLOG_PORT)"
echo "  admin: http://localhost:8081   (ADMIN_PORT, loopback only by default)"
