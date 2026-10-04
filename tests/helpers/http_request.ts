import http from "node:http";

/** Read a real HTTP response with an explicit authority and unmodified headers. */
export function httpRequest(
  url: string,
  method = "GET",
  headers: http.OutgoingHttpHeaders = {},
  body?: string,
): Promise<{
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}> {
  return new Promise((resolve, reject) => {
    const outgoing = http.request(
      url,
      {
        method,
        headers: Object.fromEntries(
          Object.entries(headers).filter(([, value]) => value !== undefined),
        ),
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("error", reject);
        response.on("end", () =>
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString(),
          }),
        );
      },
    );
    outgoing.on("error", reject);
    outgoing.end(body);
  });
}
