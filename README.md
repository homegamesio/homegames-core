# homegames
#### Play games at home

Play simple browser-based games on a local network. 

![homegames diagram](https://d3lgoy70hwd3pc.cloudfront.net/homegames.png)

Download binaries at https://homegames.io or just:
`npm install` followed by `npm run start`.

Navigate to http://homegames.link in your browser. If it doesn't work, create an issue at https://github.com/homegamesio/homegames

Sometimes there's a demo running at http://picodeg.io

#### Run with Docker

Want to run homegames core easily with docker? Well here ya go bud:


1. Navigate to root directory of homegames project

2. Run `docker build -t homegames .`

3. Run `docker run -dp 7000-7100:7000-7100 homegames`

4. That's it! The docker container should be up and running, and exposed/published on ports 7000-7100 on whatever machine you ran the above commands on

test update
