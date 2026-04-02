FROM node:20-alpine

WORKDIR /app/apps/backend

# Copy only backend package files first for better layer caching
COPY apps/backend/package.json apps/backend/package-lock.json ./

# Install all deps (devDependencies needed for nest build)
RUN npm ci --ignore-scripts

# Copy backend source
COPY apps/backend/ ./

# Build NestJS app
RUN npm run build

# Drop devDependencies for leaner runtime
RUN npm prune --production

EXPOSE 3000

CMD ["node", "dist/main.js"]
