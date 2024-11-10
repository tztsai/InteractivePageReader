function cleanHtml() {
  const doc = window.document;
  doc.querySelectorAll(
    'link, style, script, meta, noscript, header, nav, span, footer, div[role="navigation"], figure, table, .js-header-wrapper, .js-header, .js-site-search'
  ).forEach(e => e.remove());

  chrome.runtime.sendMessage(
    { message: 'readability' },
    ([{ result }]) => {
      if (result.err) {
        console.error('Error parsing content:', error);
        html = doc.querySelector('article') || doc.querySelector('main');
        if (html) doc.body.innerHTML = html.outerHTML;
      } else {
        doc.body.outerHTML = result.content;
      }
    }
  );
}

async function generateSummaries(text) {
  // const prompt = `Convert the following text provided by the user to a well-structured Markdown document. For large chunks of text, consider splitting them into smaller subsections. For each section of any level containing too much information for the user to easily digest, **write a brief summary under its header with prefix "> Summary: "**. Do your best to enable the user to clearly and quickly understand the whole document from top level to bottom.`;
  const prompt = `In the given HTML document, for each <details> element, if necessary, write a brief summary of its content. Also consider adding links in your summary to relevant headers in this document.

  Your response must strictly follow this format (each summary separated by two new lines):

  ID: Summary

  ID: Summary

  The ID is the "id" attribute of the <details> element, e.g. "id-12345".
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
    output = output.replace(/\s*```\s*[a-z]*\s*/g, '');
    splits = output.trim().split(/\n{2,}/);
    var i = 0;
    while (i < splits.length - !done) {
      if (!splits[i].trim()) break;
      try {
        const [_, id, txt] = splits[i].match(/\s*(id-\w+): ([\s\S]+)/m)
        const d = document.getElementById(id);
        if (d) {
          const p = document.createElement('blockquote');
          p.textContent = txt.trim();
          d.querySelector('summary').appendChild(p);
          // focusOnDetails(d);
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

(async () => {
  // clean the HTML content
  cleanHtml();
  // convert the page to markdown
  chrome.runtime.sendMessage(
    { message: 'turndown', content: document.body.innerHTML },
    ({ html: [{ result }], tabId }) => {
      document.body.innerHTML = result;
      // inject the markdown renderer
      chrome.runtime.sendMessage({ message: 'inject', tabId })
    }
  );
  // wait for the document loading and rendering to complete
  var timeout = setInterval(() => {
    if (document.readyState === 'complete') {
      clearInterval(timeout);
      content = document.getElementById('_html');
      if (!content) return;
      for (
        s = content.querySelector('h1')?.previousElementSibling;
        s; s = s.previousElementSibling
      ) { s.remove(); }
      // convert the markdown content to text
      if (state.content.ai)
        generateSummaries(content.outerHTML);
    }
  }, 500);
})()
