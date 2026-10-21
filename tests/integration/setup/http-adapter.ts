import http from "node:http";

/**
 * Adaptador para permitir que o Supertest execute chamadas HTTP reais
 * sobre os Route Handlers do Next.js App Router (Aula 02 - Bloco 3).
 */
export function createRouteServer(handlers: {
  POST?: (req: Request) => Promise<Response>;
  GET?: (req: Request) => Promise<Response>;
}) {
  return http.createServer(async (req, res) => {
    try {
      const url = `http://${req.headers.host || "localhost"}${req.url || "/"}`;
      const method = req.method || "GET";

      let body: string | undefined;
      if (method === "POST" || method === "PUT" || method === "PATCH") {
        const buffers: Uint8Array[] = [];
        for await (const chunk of req) {
          buffers.push(chunk);
        }
        body = Buffer.concat(buffers).toString("utf-8");
      }

      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value) {
          if (Array.isArray(value)) {
            value.forEach((v) => headers.append(key, v));
          } else {
            headers.set(key, value);
          }
        }
      }

      const webRequest = new Request(url, {
        method,
        headers,
        body: body ? body : undefined,
      });

      let response: Response;
      if (method === "POST" && handlers.POST) {
        response = await handlers.POST(webRequest);
      } else if (method === "GET" && handlers.GET) {
        response = await handlers.GET(webRequest);
      } else {
        response = new Response("Method not allowed", { status: 405 });
      }

      res.statusCode = response.status;
      response.headers.forEach((val, key) => {
        res.setHeader(key, val);
      });

      const responseText = await response.text();
      res.end(responseText);
    } catch (err: any) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ code: "INTERNAL_ERROR", message: err.message }));
    }
  });
}
