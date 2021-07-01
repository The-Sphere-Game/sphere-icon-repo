FROM node:16.2.0
WORKDIR /app


COPY app /app
RUN npm install typescript -g
RUN npm i @types/node 

RUN npm run build
CMD npm run start
