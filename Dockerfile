FROM node:lts-slim
RUN npm install -g serve;
COPY dist/ /dist
EXPOSE 80
CMD ["/usr/local/bin/serve", "-s", "/dist", "-p", "80"]
