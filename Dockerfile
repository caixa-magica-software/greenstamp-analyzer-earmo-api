FROM node:14-alpine

RUN apk add openjdk11

RUN mkdir /analyzer-earmo-api
# Create app directory
WORKDIR /analyzer-earmo-api

COPY ./package*.json ./

RUN npm install

# Bundle app source
COPY . .
EXPOSE 3000

CMD [ "npm", "start" ]