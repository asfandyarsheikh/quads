FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application files
COPY database.js ./
COPY api.js ./
COPY resolver.js ./
COPY cron.js ./
COPY .env ./

# Create data directory
RUN mkdir -p /data

# Expose ports
EXPOSE 3000 3001

# Default command (can be overridden in docker-compose)
CMD ["node", "api.js"]
