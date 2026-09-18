FROM node:24.14.0-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY server ./server
COPY shared ./shared
RUN mkdir -p /app/var && chown node:node /app/var
USER node
ENV NODE_ENV=production
ENV AGENT_SERVICE_HOST=0.0.0.0
ENV NOTIFICATION_HOST=0.0.0.0
EXPOSE 8787 8788
CMD ["node", "server/agent-service/index.mjs"]
