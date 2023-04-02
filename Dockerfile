FROM node:16

WORKDIR /server
COPY package*.json ./
RUN yarn 
COPY . .
RUN yarn run build

CMD [ "sh", "-c", "yarn run start:dev" ]