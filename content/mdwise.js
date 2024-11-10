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
  const prompt = `For each <details> element with an ID at different levels in the provided HTML document, if it contains a long text, generate a concise summary of its content. You can include <a> links in your summary that reference relevant headers within the document.

  Each summary should strictly follow the format \`#ID: Summary\`, with each one separated by **two new lines**. Ensure there are no unnecessary HTML tags or triple backticks in your response. Never put two summaries in the same line.

  **Examples:**

  #id-abcde: A brief summary of the content within <details id="id-abcde">...</details>.

  #id-12345: Summary of id-12345. Refer to <a href="#a-header">A Header</a>.
  `

  const fillSummary = (output, done) => {
    // output = output.replace(/\s*```\s*[a-z]*\s*/g, '');
    splits = output.trim().split(/\n{2,}/);
    var i = 0;
    while (i < splits.length - !done) {
      if (!splits[i].trim()) break;
      try {
        const [_, id, txt] = splits[i].match(/\s*#(id-\w+): ([\s\S]+)/m)
        const d = document.getElementById(id);
        if (d) {
          writeSummary(d, txt);
        } else {
          console.error('Invalid ID:', id)
        }
        i += 1;
      } catch (error) {
        console.error('Invalid format:', splits[i]);
        break;
      }
    }
    if (done && splits.length > 1)
      console.error('Error parsing:', output);
    return splits.slice(i).join('\n\n');
  }

  await getAIResponse(text, prompt, fillSummary);
};

function writeSummary(details, txt) {
  if (!txt) {
    var summary = document.createElement('summary');
    // move header into summary
    details.insertBefore(summary, details.firstChild);
    summary.appendChild(details.children[1]);
  } else {
    var summary = details.querySelector('summary');

    const p = document.createElement('blockquote');
    p.textContent = txt.trim();
    summary.appendChild(p);

    const qa = document.createElement('div');
    qa.className = 'ai-qa';
    qa.style.display = 'none';
    summary.appendChild(qa);

    function createInput() {
      const input = document.createElement('input');
      input.placeholder = 'Ask AI';
      qa.insertAdjacentElement('afterbegin', input);

      input.addEventListener('keydown', async (e) => {
        console.warn(JSON.stringify(e));

        e.stopPropagation();
        if (e.key === ' ') {
          e.preventDefault(); input.value += ' ';
        }
  
        if (e.key === 'Enter' && input.value.trim()) {
          // remove all siblings following the input
          while (input.previousElementSibling)
            input.previousElementSibling.remove();
  
          const question = input.value.trim();
          const prompt = `Write a short answer given the following information:
          ${details.textContent}`;
  
          const ans = document.createElement('p');
          qa.insertBefore(ans, input.nextElementSibling);
  
          await getAIResponse(question, prompt,
            (output, _) => {
              return ans.textContent = output;
            });
          
          createInput();
          // m.redraw();
          update();
        }
      });
      return input;
    }
    
    summary.addEventListener('mouseenter', () => {
      qa.style.display = 'block';
    });
    summary.addEventListener('mouseleave', () => {
      qa.style.display = 'none';
    });
    createInput();
  }
}

async function getAIResponse(text, prompt, callback = (s, d) => s) {

  const messageJson = {
    model: "gpt-4o-mini",
    messages: [{ role: 'user', content: text }],
    stream: true,
    max_tokens: 4096,
    temperature: 0.1,
  };

  if (prompt) {
    messageJson.messages.unshift({ role: 'system', content: prompt });
  }

  const apiKey = await new Promise((resolve) => {
    chrome.storage.local.get('openaiApiKey', (result) => {
      resolve(result.openaiApiKey);
    });
  });

  console.warn('Generation started.\nQuery:', text.slice(0, 300), 
    '\nPrompt:', prompt.slice(0, 500));

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

  var interval = setInterval(() => { output = callback(output, done) }, 200);

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
    if (buf) console.error('Error parsing:', buf);
    clearInterval(interval);
    console.warn('Generation complete.');
  }, 1000);

  return output;
}

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
      let html = document.getElementById('_html');
      if (!html) return;

      for (  // remove all elements before the first header
        s = html.querySelector('h1')?.previousElementSibling;
        s; s = s.previousElementSibling
      ) { s.remove(); }
      const content = html.innerHTML;

      // add summaries to the details elements
      html.querySelectorAll('details').forEach(d => writeSummary(d));

      // convert the markdown content to text
      if (state.content.ai)
        generateSummaries(content);
    }
  }, 500);
})()
