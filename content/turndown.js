if (!window.TurndownScript) {
  const turndownScript = document.createElement('script');
  turndownScript.src = chrome.runtime.getURL('vendor/turndown/turndown.browser.umd.js');
  document.head.appendChild(turndownScript);
  window.TurndownScript = turndownScript;
}

window.TurndownScript.onload = () => {
  const turndownService = new TurndownService();
  const markdown = turndownService.turndown(document.documentElement.outerHTML);
  console.log(markdown);

  // Create a new window to display the Markdown
  const markdownWindow = window.open('', '_blank');
  markdownWindow.document.write('<pre>' + markdownWindow.document.createTextNode(markdown).textContent + '</pre>');
};