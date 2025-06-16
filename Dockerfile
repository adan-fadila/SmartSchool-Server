FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install curl for health checks and other necessary tools
RUN apk add --no-cache curl

# Create app user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy the application code
COPY . .

# Create necessary directories and set permissions
RUN mkdir -p /app/logs && chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose the ports
EXPOSE 3000
EXPOSE 8001

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api-test || exit 1

# Start the application
CMD ["npm", "start"] 