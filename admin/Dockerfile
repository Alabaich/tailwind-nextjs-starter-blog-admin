FROM node:24-slim
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends git \
  && rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start"]
