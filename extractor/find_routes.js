const fs = require('fs');
const code = fs.readFileSync('E:/rag-help/rag-help-full/okyai.mantrakshdevs.com/assets/index-Dku6X86d.js', 'utf8');

// Find path definitions in React Router
const routeRegex = /path:"([^"]+)"/g;
let match;
const routes = [];
while ((match = routeRegex.exec(code)) !== null) {
  routes.push(match[1]);
}
console.log("Found routes:", routes);
