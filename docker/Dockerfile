FROM shopstic/curl-tar-unzip:1.0.0 as dumb-init

ENV DUMB_INIT_VERSION "1.2.2"

RUN \
  curl -Lo /usr/bin/dumb-init https://github.com/Yelp/dumb-init/releases/download/v${DUMB_INIT_VERSION}/dumb-init_${DUMB_INIT_VERSION}_amd64 && \
  chmod +x /usr/bin/dumb-init

FROM shopstic/deno:1.7.5

COPY --from=dumb-init /usr/bin/dumb-init /usr/bin/dumb-init

ADD ./serial-proxy.js /app/app.js
ADD ./entrypoint.sh /app/entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/app/entrypoint.sh"]