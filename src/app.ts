import {
  CliProgram,
  ConnInfo,
  createCliAction,
  createDeferred,
  Deferred,
  ExitCode,
  readableStreamFromIterable,
  serve,
  Type,
} from "./deps.ts";

interface PendingItem {
  deferredResponse: Deferred<Response>;
  connInfo: ConnInfo;
}

const queue = new Map<string, Array<PendingItem>>();

function getRequestRemoteIp(connInfo: ConnInfo) {
  return connInfo.remoteAddr.transport === "tcp"
    ? connInfo.remoteAddr.hostname
    : null;
}

function log(level: "info" | "error", attrs: Record<string, unknown>) {
  console.log(JSON.stringify({
    time: new Date().toISOString(),
    level,
    ...attrs,
  }));
}

async function proxy(
  request: Request,
  connInfo: ConnInfo,
  targetUrl: string,
  targetRequestTimeoutMs: number,
): Promise<Response> {
  const deferred = createDeferred<Response>();
  const requestUrl = new URL(request.url);
  const url = `${targetUrl}${requestUrl.pathname}${requestUrl.search}`;

  if (queue.has(url)) {
    const pendingList = queue.get(url)!;
    pendingList.push({
      deferredResponse: deferred,
      connInfo,
    });

    log("info", {
      url,
      concurrency: pendingList.length,
      remoteAddrs: pendingList
        .map(({ connInfo }) => getRequestRemoteIp(connInfo) || "unknown"),
    });

    return await deferred;
  }

  queue.set(url, [{ deferredResponse: deferred, connInfo }]);

  log("info", {
    url,
    concurrency: 1,
    remoteAddrs: [getRequestRemoteIp(connInfo) || "unknown"],
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("host");
  requestHeaders.delete("connection");

  const abort = new AbortController();
  const abortId = setTimeout(() => abort.abort(), targetRequestTimeoutMs);

  const responseBuilder = await (async () => {
    try {
      const startTime = performance.now();
      const response = await fetch(url, {
        method: request.method,
        headers: requestHeaders,
        signal: abort.signal,
      });
      const elapse = Math.round((performance.now() - startTime) * 100) / 100;

      const body = new Uint8Array(await response.arrayBuffer());
      const remoteIp = getRequestRemoteIp(connInfo);
      const responseHeaders = new Headers(response.headers);

      if (remoteIp !== null) {
        responseHeaders.set("x-forwarded-for", remoteIp);
      }

      if (responseHeaders.get("transfer-encoding") === "chunked") {
        responseHeaders.delete("transfer-encoding");
      }

      responseHeaders.delete("trailer");

      log("info", {
        url,
        status: response.status,
        elapseMs: elapse,
      });

      return () =>
        new Response(readableStreamFromIterable([body]), {
          status: response.status,
          headers: responseHeaders,
        });
    } catch (e) {
      log("error", {
        url,
        error: e.toString(),
      });

      if (e instanceof DOMException && e.name === "AbortError") {
        return () =>
          new Response(
            `Timed out requesting ${url} after ${targetRequestTimeoutMs}ms`,
            {
              status: 504,
            },
          );
      }

      return () =>
        new Response(e.toString(), {
          status: 500,
        });
    } finally {
      clearTimeout(abortId);
    }
  })();

  const pendingRequests = queue.get(url)!;
  queue.delete(url);

  await Promise.all(
    pendingRequests.map(({ deferredResponse }) => {
      deferredResponse.resolve(responseBuilder());
      return deferredResponse.catch((e) => {
        if (
          !(e instanceof Deno.errors.BrokenPipe) &&
          !(e instanceof Deno.errors.ConnectionReset)
        ) {
          console.error(e);
        }
      });
    }),
  );

  return await deferred;
}

const start = createCliAction(
  Type.Object({
    hostname: Type.Optional(Type.String({ minLength: 1 })),
    port: Type.Optional(Type.Number({ minimum: 0, maximum: 65535 })),
    targetRequestTimeoutMs: Type.Number({ minimum: 1 }),
    proxyTarget: Type.String({ format: "uri" }),
  }),
  async (
    { hostname = "0.0.0.0", port = 8080, proxyTarget, targetRequestTimeoutMs },
  ) => {
    log("info", {
      message: "Proxy server is up",
      hostname,
      port,
      proxyTarget,
      targetRequestTimeoutMs,
    });

    await serve(
      (request, connInfo) =>
        proxy(request, connInfo, proxyTarget, targetRequestTimeoutMs),
      {
        hostname,
        port,
      },
    );

    return ExitCode.One;
  },
);

await new CliProgram().addAction("start", start).run(Deno.args);
