FROM node:24-alpine
RUN apk add --no-cache docker-cli docker-cli-compose docker-cli-buildx
WORKDIR /srv
ENV NODE_ENV=production
# No build step and no node_modules: Node runs the TypeScript sources directly.
COPY package.json ./
COPY src ./src
HEALTHCHECK --interval=5s --timeout=3s --start-period=5s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:8000/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "--disable-warning=ExperimentalWarning", "src/server.ts"]
