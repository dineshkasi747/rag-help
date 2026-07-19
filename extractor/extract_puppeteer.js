const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const http = require('http');

const servePath = "E:\\rag-help\\rag-help-full\\okyai.mantrakshdevs.com";

const possibleBrowsers = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe",
  process.env.LOCALAPPDATA + "\\Microsoft\\Edge\\Application\\msedge.exe"
];

let executablePath = possibleBrowsers.find(p => p && fs.existsSync(p));

const server = http.createServer((req, res) => {
  let reqUrl = req.url.split('?')[0];
  let filePath = path.join(servePath, reqUrl === "/" ? "index.html" : reqUrl);

  if (!fs.existsSync(filePath) && !path.extname(filePath)) {
    filePath = path.join(servePath, "index.html");
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.otf': 'application/font-otf',
    '.ttf': 'application/font-ttf',
    '.woff': 'application/font-woff',
    '.woff2': 'font/woff2',
    '.ico': 'image/x-icon'
  };
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code == 'ENOENT') {
        res.writeHead(404);
        res.end("404 Not Found");
      } else {
        res.writeHead(500);
        res.end('Error: '+error.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(8181, async () => {
  console.log("Server running at http://127.0.0.1:8181/");
  console.log("Using browser executable:", executablePath);

  try {
    const launchOptions = {
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    };
    if (executablePath) {
      launchOptions.executablePath = executablePath;
    }

    const browser = await puppeteer.launch(launchOptions);
    
    console.log("Browser launched successfully.");
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    page.setDefaultNavigationTimeout(0);

    const pagesToExtract = [
      { name: "dashboard", url: "http://127.0.0.1:8181/dashboard" },
      { name: "chatbot", url: "http://127.0.0.1:8181/chatbot" },
      { name: "analytics", url: "http://127.0.0.1:8181/analytics" },
      { name: "content-tools", url: "http://127.0.0.1:8181/content-tools" },
      { name: "subscription", url: "http://127.0.0.1:8181/subscription" },
      { name: "settings", url: "http://127.0.0.1:8181/settings" },
      { name: "login", url: "http://127.0.0.1:8181/login" },
      { name: "register", url: "http://127.0.0.1:8181/register" }
    ];

    for (const target of pagesToExtract) {
      console.log(`Navigating to ${target.name} (${target.url})...`);
      await page.goto(target.url, { waitUntil: 'networkidle0', timeout: 60000 });
      // Wait for React rendering & preloader to finish (loader usually hides after 2.5s)
      await new Promise(r => setTimeout(r, 4000));
      const htmlContent = await page.content();
      const outPath = path.join("E:\\rag-help\\extractor", `${target.name}_dom.html`);
      fs.writeFileSync(outPath, htmlContent);
      console.log(`Extracted ${target.name}! (Length: ${htmlContent.length} bytes)`);
    }

    await browser.close();
    console.log("All extractions complete!");
    process.exit(0);
  } catch (err) {
    console.error("Puppeteer Error:", err);
    process.exit(1);
  }
});
