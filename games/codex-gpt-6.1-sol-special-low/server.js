const http = require("http"),
  fs = require("fs"),
  path = require("path");
http
  .createServer((req, res) => {
    const p = path.join(
      __dirname,
      decodeURIComponent(
        req.url.split("?")[0] === "/" ? "/index.html" : req.url.split("?")[0],
      ),
    );
    if (!p.startsWith(__dirname)) {
      res.writeHead(403);
      return res.end();
    }
    fs.readFile(p, (e, d) => {
      if (e) {
        res.writeHead(404);
        return res.end("Not found");
      }
      res.setHeader(
        "Content-Type",
        {
          ".html": "text/html",
          ".js": "text/javascript",
          ".css": "text/css",
          ".json": "application/json",
          ".wav": "audio/wav",
        }[path.extname(p)] || "application/octet-stream",
      );
      res.end(d);
    });
  })
  .listen(4173, "0.0.0.0", () =>
    console.log("Crown & Tide http://localhost:4173"),
  );
