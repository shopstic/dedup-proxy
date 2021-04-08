import { Type } from "https://raw.githubusercontent.com/shopstic/typebox/0.16.2/src/typebox.ts";
import {
  CliProgram,
  createCliAction,
  ExitCode,
} from "https://raw.githubusercontent.com/shopstic/deno-utils/1.3.0/src/cli-utils.ts";
import { serve } from "https://deno.land/std@0.92.0/http/server.ts";
import type { ServerRequest } from "https://deno.land/std@0.92.0/http/server.ts";

const queue = new Map<string, ServerRequest[]>();

function getRequestRemoteIp(request: ServerRequest) {
  const remoteAddr = request.conn.remoteAddr;
  return remoteAddr.transport === "tcp" ? remoteAddr.hostname : null;
}

async function proxy(request: ServerRequest, targetUrl: string): Promise<void> {
  const url = `${targetUrl}${request.url}`;

  if (queue.has(url)) {
    const pendingList = queue.get(url)!;
    pendingList.push(request);

    console.log(
      `[${url}][concurrency=${pendingList.length}] ${
        pendingList
          .map((r) => getRequestRemoteIp(r) || "unknown")
          .join(", ")
      }`,
    );

    return;
  }

  queue.set(url, [request]);

  console.log(
    `[${url}][concurrency=1] ${getRequestRemoteIp(request) || "unknown"}`,
  );

  const requestHeaders = request.headers;
  requestHeaders.delete("host");
  requestHeaders.delete("connection");

  const response = await fetch(url, {
    method: request.method,
    headers: requestHeaders,
  });

  const remoteIp = getRequestRemoteIp(request);
  const responseHeaders = response.headers;

  if (remoteIp !== null) {
    responseHeaders.set("X-Forwarded-For", remoteIp);
  }

  if (responseHeaders.get("Transfer-Encoding") === "chunked") {
    responseHeaders.delete("Transfer-Encoding");
  }

  const body = new Uint8Array(await response.arrayBuffer());

  const pendingRequests = queue.get(url)!;
  queue.delete(url);

  await Promise.all(
    pendingRequests.map((r) =>
      r
        .respond({
          status: response.status,
          headers: responseHeaders,
          trailers: response.trailer ? () => response.trailer : undefined,
          body,
        })
        .catch((e) => {
          if (
            !(e instanceof Deno.errors.BrokenPipe) &&
            !(e instanceof Deno.errors.ConnectionReset)
          ) {
            console.error(e);
          }
        })
    ),
  );
}

const start = createCliAction(
  Type.Object({
    hostname: Type.Optional(Type.String({ minLength: 1 })),
    port: Type.Optional(Type.Number({ minimum: 0, maximum: 65535 })),
    proxyTarget: Type.String({ format: "uri" }),
  }),
  async ({ hostname = "0.0.0.0", port = 8080, proxyTarget }) => {
    const server = serve({ hostname, port });

    console.log(`Proxy server is up at ${hostname}:${port}`);

    for await (const request of server) {
      proxy(request, proxyTarget);
    }

    return ExitCode.One;
  },
);

await new CliProgram().addAction("start", start).run(Deno.args);
