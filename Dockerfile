# Fetch image of node v18
FROM node:18

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install
# If you are building your code for production
# RUN npm ci --only=production

COPY . .

# homegames server sessions can take this port range currently
EXPOSE 7000-7100

CMD [ "node", "game_server.js" ]

