const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs");
const path = require("path");
const http = require("http");

const servePath = "E:\\rag-help\\rag-help-full\\okyai.mantrakshdevs.com";

const server = http.createServer((req, res) => {
  let filePath = path.join(servePath, req.url === "/" ? "index.html" : req.url);
  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.png': 'image/png'
  };
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end();
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(8181, async () => {
  const virtualConsole = new VirtualConsole();
  virtualConsole.sendTo(console);

  try {
    const dom = await JSDOM.fromURL("http://127.0.0.1:8181/dashboard.html", {
      runScripts: "dangerously",
      resources: "usable",
      pretendToBeVisual: true,
      virtualConsole
    });

    setTimeout(() => {
      fs.writeFileSync("E:\\rag-help\\extractor\\dashboard_dom.html", dom.window.document.documentElement.outerHTML);
      console.log("Extracted");
      process.exit(0);
    }, 8000);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
});
