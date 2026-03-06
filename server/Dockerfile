FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src/ ./src/

# Default command is the API server; override with "node src/sync.js" for the sync service
CMD ["node", "src/server.js"]
