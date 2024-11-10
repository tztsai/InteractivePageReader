async function convertToMD(content) {
  await import('/vendor/turndown.min.js');  
  const turndownService = new TurndownService();
  turndownService.remove(
    ['input', 'textarea', 'form', 'aside', 'nav', 'button', 'canvas', 'audio', 'video', 'label', 'select', 'option', 'datalist', 'keygen', 'output', 'progress', 'meter', 'menu', 'menuitem']
  );
  return turndownService.turndown(content);
}

async function generateSummaries(text) {
  // const prompt = `Convert the following text provided by the user to a well-structured Markdown document. For large chunks of text, consider splitting them into smaller subsections. For each section of any level containing too much information for the user to easily digest, **write a brief summary under its header with prefix "> Summary: "**. Do your best to enable the user to clearly and quickly understand the whole document from top level to bottom.`;
  const prompt = `In the given HTML file, for each <details> element, if necessary, write a proper and brief summary of its content.

  Your response must strictly follow this format (each summary separated by two new lines):

  ID: Summary

  ID: Summary

  The ID is the "id" attribute of the <details> element, e.g. "det-12345".
  `

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
  var output = '';
  var buf = '';
  var done = false;

  const fillSummary = () => {
    output = output.trim().replace(/^```\s*[a-z]*$/g, '');
    splits = output.split(/\n{2,}/);
    var i = 0;
    while (i < splits.length - !done) {
      if (!splits[i].trim()) break;
      try {
        const [_, id, txt] = splits[i].match(/\s*(det-\w+): ([\s\S]+)/m)
        const element = document.getElementById(id);
        if (element) {
          const p = document.createElement('p');
          p.textContent = txt.trim();
          // element.insertAdjacentElement('afterbegin', p);
          element.querySelector('summary').appendChild(p);
        } else {
          console.error('Invalid ID:', id)
        }
        i += 1;
      } catch (error) {
        console.error('Invalid format:', splits[i]);
        break;
      }
    }
    output = splits.slice(i).join('\n\n');
  }

  var interval = setInterval(fillSummary, 200);

  while (true) {
    var { done, value } = await reader.read();
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
        if (content) output += content;
        buf = '';
      } catch (error) {
        // console.warn('Error parsing JSON:', error);
      }
    }
  }

  setTimeout(() => {
    if (output + buf)
      console.error('Error parsing:', output + buf);
    clearInterval(interval);
  }, 1000);
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
  // inject the markdown renderer
  chrome.runtime.sendMessage(
    { message: 'inject', url: window.location.href },
  );
  // wait for the document loading to complete
  var timeout = setInterval(() => {
    if (document.readyState === 'complete') {
      // wait for markdown rendering to complete
      clearInterval(timeout);
      setTimeout(async () => {
        content = document.getElementById('_html').outerHTML;
        // convert the markdown content to text
        await generateSummaries(content);
      }, 200);
    }
  }, 20);
})()
