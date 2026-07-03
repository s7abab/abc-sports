import { createServer } from "http";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const server = createServer();
const app = next({ dev, hostname, port, httpServer: server });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  server.on("request", (req, res) => {
    handle(req, res);
  });

  server.listen(port, hostname, () => {
    console.log(`> Server listening at http://${hostname}:${port} as ${dev ? "development" : "production"}`);
  });
});
