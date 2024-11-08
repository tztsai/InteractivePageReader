const turndownScript = document.createElement('script');
turndownScript.src = chrome.runtime.getURL('vendor/turndown.min.js');
const dominoScript = document.createElement('script');
dominoScript.src = chrome.runtime.getURL('vendor/domino.min.js');
turndownScript.onload = () => {
  const turndownService = new TurndownService();
  const markdown = turndownService.turndown(document.documentElement.outerHTML);

  // Create a new window to display the Markdown
  const markdownWindow = window.open('', '_blank');
  markdownWindow.document.write('<pre>' + markdownWindow.document.createTextNode(markdown).textContent + '</pre>');
};
document.head.appendChild(dominoScript);
document.head.appendChild(turndownScript);