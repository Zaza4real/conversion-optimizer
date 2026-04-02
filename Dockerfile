FROM node:20-alpine

WORKDIR /app/apps/backend

# Copy package.json first for layer caching
COPY apps/backend/package.json ./

# Install all deps (using npm install not npm ci to avoid lockfile cache issues)
RUN npm install --ignore-scripts --no-audit --no-fund

# Copy backend source (includes committed dist/)
COPY apps/backend/ ./

# Build NestJS app from latest TypeScript source
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/main.js"]
