FROM docker:27-cli
RUN apk add --no-cache nodejs docker-cli-compose docker-cli-buildx
WORKDIR /srv
COPY server.js .
CMD ["node", "server.js"]
