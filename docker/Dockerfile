FROM node:24.22.0-bookworm-slim
WORKDIR /app

# The context supplies the installed, reviewed production dependencies. No npm
# install, sibling checkout, private configuration or game library is needed.
COPY node_modules ./node_modules
COPY src ./src
COPY package.json LICENSE.md THIRD_PARTY_NOTICES.md ./
COPY container-entry.js validate.js ./
ENV NODE_PATH=/app/node_modules
RUN mkdir -p /app/save /app/game
ENTRYPOINT ["node"]
CMD ["container-entry.js"]
