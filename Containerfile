FROM registry.access.redhat.com/ubi9/ubi-minimal
RUN microdnf install -y npm; npm install -g serve;
COPY dist/ /dist
EXPOSE 80
CMD ["/usr/local/bin/serve", "-s", "/dist", "-p", "80"]
