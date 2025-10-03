# Communication Service Dockerfile
FROM node:18-alpine

# Install system dependencies for serial communication
RUN apk add --no-cache \
    curl \
    bash \
    python3 \
    py3-pip \
    build-base \
    linux-headers

# Set working directory
WORKDIR /app

# Create non-root user and add to dialout group for serial access
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    addgroup nodejs dialout

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application code
COPY . .

# Change ownership to nodejs user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3005

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3005/health || exit 1

# Start the application
CMD ["npm", "start"]