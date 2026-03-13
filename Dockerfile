FROM node:22-alpine

WORKDIR /app

# Install build tools needed for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++

# Install dependencies first (cached layer)
COPY package*.json ./
RUN npm ci

# Copy app files
COPY . .

EXPOSE 3334

CMD ["node", "server.js"]
