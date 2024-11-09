async function convertToMD(content) {
  await import('/vendor/turndown.min.js');  
  const turndownService = new TurndownService();
  turndownService.remove(['input', 'textarea', 'form', 'aside', 'nav', 'button', 'canvas', 'audio', 'video', 'iframe', 'label']);
  return turndownService.turndown(content);
}

async function MDwise(text) {
  const prompt = `Convert the following text provided by the user to a well-structured Markdown document. For large chunks of text, consider splitting them into smaller subsections. For each section of any level containing too much information for the user to easily digest, **write a brief summary under its header with prefix "> Summary: "**. Do your best to enable the user to clearly and quickly understand the whole document from top level to bottom.`;

  const messageJson = {
    model: "gpt-4o-mini",
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: text }, 
    ],
    stream: true,
    max_tokens: 4096,
    // temperature: 0.1,
  };

  const apiKey = await new Promise((resolve) => {
    chrome.storage.local.get('openaiApiKey', (result) => {
      resolve(result.openaiApiKey);
    });
  });

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(messageJson),
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  markdown = '';
  buf = '';

  const interval = setInterval(() => render(markdown), 1000);

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split(/data: (?=[{[])/)
      .map((line) => line.trim())
      .filter((line) => line !== "" && line !== "[DONE]");

    for (const line of lines) {
      buf += line;
      try {
        const parsedLine = JSON.parse(buf);
        const content = parsedLine.choices[0].delta.content;
        if (content) markdown += content;
        buf = '';
      } catch (error) {
        // console.warn('Error parsing JSON:', error);
      }
    }
  }
  if (buf.length > 0) {
    console.error('Error parsing JSON:', buf);
  }

  clearInterval(interval);
  render(markdown);
};

function fixTurnDown(md) {
  md = md.replace(/^(#*\s*)\[(\s*\n)+/gm, '$1[');
  return md;
}

function cleanHtml(doc) {
  doc.querySelectorAll(
    'link, style, script, meta, noscript, header, nav, footer, div[role="navigation"]'
  ).forEach(e => e.remove());
  html = doc.querySelector('main') || doc.body;
  return html;
}

(async () => {
  content = cleanHtml(document)
  // convert the page to markdown
  const md = fixTurnDown(await convertToMD(content));
  document.body.innerHTML = `<pre>${md}</pre>`;
  // inject the renderer
  chrome.runtime.sendMessage({ message: 'inject', url: window.location.href });
  // dynamical AI summarization
  // await MDwise(md);
})()
