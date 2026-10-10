# Build from the repository root so the app's logic modules come along:
#   docker build -f server/Dockerfile -t dozi-notifier .
FROM node:22-slim
WORKDIR /app
# The root package.json marks /app/js as ES modules.
COPY package.json ./package.json
COPY js ./js
COPY server/package.json ./server/package.json
RUN cd server && npm install --omit=dev
COPY server/src ./server/src
WORKDIR /app/server
CMD ["node", "src/index.js"]
