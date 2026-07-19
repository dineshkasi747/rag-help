const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('E:\\rag-help\\extractor\\dashboard_dom.html', 'utf8');
const dom = new JSDOM(html);
const document = dom.window.document;

const root = document.getElementById('root');
if (root) {
  // Let's print the top level children of root
  console.log("--- TOP LEVEL ---");
  Array.from(root.children).forEach((el, i) => {
    console.log(`Child ${i}: <${el.tagName.toLowerCase()} class="${el.className}">`);
  });

  // Find the sidebar (usually a nav or aside, or a div with sidebar classes)
  const sidebar = document.querySelector('aside') || document.querySelector('[class*="sidebar"]');
  if (sidebar) {
    console.log("\n--- SIDEBAR ---");
    console.log(sidebar.outerHTML.substring(0, 1000) + '...');
  }

  // Find the header
  const header = document.querySelector('header');
  if (header) {
    console.log("\n--- HEADER ---");
    console.log(header.outerHTML.substring(0, 1000) + '...');
  }
}
