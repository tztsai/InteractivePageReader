async function MDwise(content, use_ai = false) {
  await import('/vendor/turndown.min.js');  

  const turndownService = new TurndownService();
  turndownService.remove(['script', 'style', 'input', 'textarea', 'form', 'noscript', 'aside', 'nav', 'button']);
  let markdown = turndownService.turndown(content);
  
  if (!use_ai) return markdown;

  const prompt = `Convert the following text provided by the user to a well-structured Markdown document. For large chunks of text, consider splitting them into smaller subsections. For each section of any level containing too much information for the user to easily digest, **write a brief summary under its header with prefix "> Summary: "**. Do your best to enable the user to clearly and quickly understand the whole document from top level to bottom.`;

  const messageJson = {
    model: "gpt-4o-mini",
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: markdown },
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
  return markdown;
};

async function createNewTab(markdown) {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    chrome.tabs.create({ url: 'about:blank' }, (tab) => {
      console.warn('Creating new tab with URL:', url);
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      const tabId = tab.id;
      chrome.scripting.executeScript({
        target: { tabId },
        func: (markdown) => {
          document.body.innerHTML = `<pre>${markdown}</pre>`;
        },
        args: [markdown]
      }, () => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        resolve(tabId);
      });
    });
  });
};

(async () => {
  const md = await MDwise(document.body);
  const tabId = await createNewTab(md);
  chrome.runtime.sendMessage({ message: 'inject', tabId });
})()
