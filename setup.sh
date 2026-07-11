#!/usr/bin/env bash
set -euo pipefail

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
  if command -v openssl >/dev/null 2>&1; then
    sed -i.bak "s|^SESSION_SECRET=.*|SESSION_SECRET=$(openssl rand -hex 32)|" .env
    sed -i.bak "s|^DEPLOY_TOKEN=.*|DEPLOY_TOKEN=$(openssl rand -hex 32)|" .env
    rm -f .env.bak
    echo "Generated SESSION_SECRET and DEPLOY_TOKEN in .env"
  fi
  echo ""
  echo "Now edit .env: set ADMIN_EMAIL and ADMIN_PASSWORD."
fi

echo ""
echo "Next steps:"
echo "  docker compose up -d --build"
echo "  blog:  http://localhost:\${BLOG_PORT:-8080}"
echo "  admin: http://localhost:\${ADMIN_PORT:-8081}"
