FROM node:24-slim
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# git records content history inside the mounted site/ checkout.
RUN apt-get update && apt-get install -y --no-install-recommends git \
  && rm -rf /var/lib/apt/lists/*
# Dependencies are their own layer and come from the lockfile, so builds are
# reproducible and cached until package-lock.json changes.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start"]
