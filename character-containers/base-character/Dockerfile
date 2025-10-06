# Character Container Dockerfile
FROM node:18-alpine AS base

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install --only=production && npm cache clean --force

# Development stage
FROM base AS development

# Install all dependencies including dev dependencies
RUN npm install && npm cache clean --force

# Copy source code
COPY . .

# Create directories for persistent data
RUN mkdir -p ./data ./logs

# Set proper permissions
RUN chown -R node:node /app

# Switch to node user
USER node

# Expose API port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { \
    res.statusCode === 200 ? process.exit(0) : process.exit(1); \
  }).on('error', () => process.exit(1));"

# Start application in development mode with hot reload
CMD ["npm", "run", "dev"]

# Production stage
FROM base AS production

# Copy source code
COPY --chown=node:node . .

# Create directories for persistent data
RUN mkdir -p ./data ./logs && chown -R node:node ./data ./logs

# Switch to node user
USER node

# Expose API port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { \
    res.statusCode === 200 ? process.exit(0) : process.exit(1); \
  }).on('error', () => process.exit(1));"

# Start application
CMD ["npm", "start"]