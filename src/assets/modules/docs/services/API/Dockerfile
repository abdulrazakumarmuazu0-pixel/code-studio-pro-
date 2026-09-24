FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN test -f package-lock.json && npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY src ./src
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
CMD ["node", "src/server.js"]
