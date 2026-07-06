FROM node:18-slim

WORKDIR /app

# Copy homegames-common as a local module inside the image
# The build script (build-image.sh) copies it to docker/build-deps/ before building
COPY build-deps/homegames-common /app/homegames-common

# Install homegames-common's own dependencies first
WORKDIR /app/homegames-common
RUN npm install --production && rm -rf /root/.npm /tmp/*

# Now install the main app dependencies (squish versions + ws)
WORKDIR /app
COPY package.json .
RUN npm install --production && rm -rf /root/.npm /tmp/*

# Make homegames-common resolvable via require('homegames-common')
RUN ln -sf /app/homegames-common /app/node_modules/homegames-common

# Copy homegames-core source files needed for the full GameSession stack.
# child_game_server.js lives inside src/ and uses relative requires
# (./GameSession, ./util/socket, etc.) so the whole src/ tree must be together.
COPY build-deps/homegames-core-src /app/src

# Copy the container entry script
COPY container-entry.js .
COPY validate.js .

# Create mount points
RUN mkdir -p /app/save /app/game

ENTRYPOINT ["node"]
CMD ["container-entry.js"]
