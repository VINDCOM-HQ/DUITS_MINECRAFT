# Use a lightweight Node.js image
FROM node:18-alpine

# Create app directory and set as working directory
WORKDIR /usr/src/app

# Install SMB client tools for Linux
RUN apk update && \
    apk add --no-cache \
    cifs-utils \
    samba-client \
    bash \
    util-linux

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --production --ignore-scripts --prefer-offline

# Copy app source (lib directory needed from parent)
COPY . .
COPY ../lib ./lib/

# Create volume for configuration
VOLUME /usr/src/app/config

# Expose default agent port 
# The actual port used is configured via AGENT_PORT env var or config file
EXPOSE 3500

# Default environment variables
ENV NODE_ENV=production \
    AGENT_PORT=3500 \
    AGENT_LOG_FORMAT=combined \
    AGENT_CONFIG_FILE=/usr/src/app/config/config.json

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -q -O- http://localhost:$AGENT_PORT/health || exit 1

# Run as non-root user for security
USER node

# Start the agent
CMD ["node", "index.js"]