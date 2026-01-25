# Build stage
FROM node:20-alpine AS builder

# Install build dependencies for native modules (better-sqlite3, tfjs-node)
RUN apk add --no-cache python3 make g++ gcc libc-dev

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev) for building
RUN npm ci

# Copy source files
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

# Install runtime dependencies for native modules
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install build tools temporarily for native module compilation
# Then install production dependencies and remove build tools
RUN apk add --no-cache --virtual .build-deps python3 make g++ gcc libc-dev \
    && npm ci --omit=dev \
    && apk del .build-deps

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Create data directory for SQLite persistent storage
RUN mkdir -p /data && chown -R node:node /data

# Set environment variables
ENV NODE_ENV=production
ENV DATABASE_PATH=/data/metamorph.db
ENV PORT=3001

# Use non-root user for security
USER node

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

CMD ["node", "dist/server/index.js"]
