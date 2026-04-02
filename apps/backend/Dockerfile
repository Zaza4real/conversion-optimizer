FROM node:20-alpine

WORKDIR /app

# Copy package.json first for better layer caching
COPY package.json ./

# Install all deps (including devDependencies needed for nest build)
# Using npm install (not npm ci) so Railway's cached build layers don't break
RUN npm install --ignore-scripts --no-audit --no-fund

# Copy source (includes committed dist/ so node dist/main.js works immediately)
COPY . .

# Build NestJS app from latest TypeScript source
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/main.js"]
