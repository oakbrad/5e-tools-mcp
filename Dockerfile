FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY dist/ dist/
COPY prompts/ prompts/

VOLUME /data
ENV FIVETOOLS_SRC_DIR=/data
ENV MCP_HTTP_PORT=3524

EXPOSE 3524

HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
  CMD node -e "fetch('http://localhost:3524/health').then(r=>{if(!r.ok)throw r})"

CMD ["node", "dist/server.js"]
