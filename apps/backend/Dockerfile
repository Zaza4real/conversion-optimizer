FROM node:20-alpine

WORKDIR /app

# Copy lockfile + package manifest first (better layer caching)
COPY package.json package-lock.json ./

# Install all deps (including devDependencies needed for nest build)
RUN npm ci --ignore-scripts

# Copy source
COPY . .

# Build NestJS app
RUN npm run build

# Drop devDependencies for a leaner runtime image
RUN npm prune --production

EXPOSE 3000

CMD ["node", "dist/main.js"]
