# syntax=docker/dockerfile:1
# This Dockerfile is copied into ./site/ by setup.sh.
# Layering strategy (option "a"):
#   1. dependency install is its own layer -> cached until package.json changes
#   2. source + content copied afterwards
#   3. `next build` uses a BuildKit cache mount for .next/cache, so incremental
#      rebuilds after a new post take well under a minute on a small VPS.

FROM node:25-slim
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install --immutable

COPY . .
RUN --mount=type=cache,target=/app/.next/cache yarn build

EXPOSE 3000
CMD ["yarn", "serve"]
