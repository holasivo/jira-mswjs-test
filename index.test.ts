import { DeferredPromise } from "@open-draft/deferred-promise";
import axios from "axios";
import { HttpServer } from "@open-draft/test-server/http";
import { ClientRequestInterceptor } from "@mswjs/interceptors/ClientRequest";
import { RequestHandler } from "express";

const interceptor = new ClientRequestInterceptor();

export const useCors: RequestHandler = (req, res, next) => {
  res.set({
    "Access-Control-Allow-Origin": "*",
  });
  return next();
};

describe("Test for {}", () => {
  const httpServer = new HttpServer((app: any) => {
    app.use(useCors);
    app.get("/books", (_req: any, res: any) => {
      res.status(200).json([
        {
          title: "The Lord of the Rings",
          author: "J. R. R. Tolkien",
        },
        {
          title: "The Hobbit",
          author: "J. R. R. Tolkien",
        },
      ]);
    });
  });
  beforeAll(async () => {
    await httpServer.listen();
    interceptor.apply();
  });

  afterEach(() => {
    interceptor.removeAllListeners();
  });

  afterAll(async () => {
    interceptor.dispose();
    await httpServer.close();
  });

  /**
   * @see https://github.com/mswjs/interceptors/issues/564
   */
  it('preserves "auth" (Authorization)', async () => {
    const getRequestPromise = new DeferredPromise<Request>();

    interceptor.on("request", ({ request }) => {
      // Axios/XHR also dispatches an "OPTIONS" preflight request.
      // We only ever care about GET here.
      if (request.method === "GET") {
        getRequestPromise.resolve(request);
      }
    });

    // Construct an Axios request with "auth".
    await axios.get(httpServer.http.url("/books"), {
      auth: {
        // Use an email address as the username.
        // This must NOT be encoded.
        username: "foo@bar.com",
        password: "secret123",
      },
    });

    const request = await getRequestPromise;
    expect(request.headers.get("Authorization")).toBe(
      `Basic ${btoa("foo@bar.com:secret123")}`
    );
  });
});
