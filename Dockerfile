# Multi-stage: build is not needed; serve static + node server
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY server/package.json ./server/package.json
RUN cd server && npm install --omit=dev
COPY . .
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server/index.js"]
