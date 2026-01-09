# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (production only)
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:18-alpine

LABEL maintainer="School Management API"
LABEL version="1.0.0"
LABEL description="School Management System REST API"

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy node_modules from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=nodejs:nodejs . .

# Expose the port
EXPOSE 5111

# Switch to non-root user
USER nodejs

# Start the application
CMD ["node", "index.js"]
