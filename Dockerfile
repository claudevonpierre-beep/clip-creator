FROM node:22-slim

WORKDIR /app

# Install build tools for better-sqlite3 native compilation (Debian)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy app files
COPY . .

EXPOSE 8080

CMD ["node", "server.js"]
