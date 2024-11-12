function cleanHtml() {
  if (articles = document.querySelectorAll('article')) {
    document.body.innerHTML = '';
    articles.forEach(e => document.body.appendChild(e));
  } else if (main = document.querySelector('main')) {
    document.body.innerHTML = main.innerHTML;
  }
  document.querySelectorAll(
    'link, style, script, meta, noscript, header, nav, span, footer, figure, table'
  ).forEach(e => e.remove());
}

async function generateSummaries(html) {
  const prompt = `For each <details> element with an ID at different levels in the provided HTML document, if it contains a long text, generate a concise summary of its content. You can include <a> links in your summary that reference relevant headers within the document.

  Each summary should strictly follow the format \`#ID: Summary\`, with each one separated by **two new lines**. Ensure there are no unnecessary HTML tags or triple backticks in your response. Never put two summaries in the same line.

  **Examples:**

  #id-abcde: A brief summary of the content within <details id="id-abcde">...</details>.

  #id-12345: Summary of id-12345. Refer to <a href="#a-header">A Header</a>.
  `

  const content = html.innerHTML;

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

  await getAIResponse(content, prompt, fillSummary);
};

function writeSummary(details, txt) {
  const summary = details.querySelector('summary');

  const p = document.createElement('p');
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
        update();  // render the new content
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

var makeFoldable = (selector = 'h1, h2, h3, h4, h5') => {
  document.querySelectorAll(selector).forEach(header => {
    const parent = header.parentNode;
    if (parent.tagName === 'SUMMARY') return;

    const details = document.createElement('details');
    const summary = document.createElement('summary');
    details.appendChild(summary);

    if (header.tagName <= 'H3') {
      details.id = 'id-' + Math.random().toString(36).substring(2, 7);
    }

    const div = document.createElement('div');
    div.classList.add('foldable', header.tagName.toLowerCase());
    details.appendChild(div);

    for (
      let s = header.nextElementSibling, p;
      s && (!/^H[1-6]$/.test(s.tagName) || s.tagName > header.tagName);
      s = p
    ) {
      p = s.nextElementSibling;
      div.appendChild(s);
    }

    parent.replaceChild(details, header);
    summary.appendChild(header);

    // Expand a details element when hovering over it
    header.addEventListener('mouseenter', () => {
      !scrollLock && focusOnDetails(details);
    });
  });
}

var focusedDetails;
var scrollLock = false;

var focusOnDetails = (details, scroll = 'follow') => {
  if (
    scrollLock && focusedDetails
    && findNext(details) !== focusedDetails
    && findPrev(details) !== focusedDetails
  ) {
    focusedDetails = details;
    return;
  }

  scrollLock = true;
  details.open = true;

  const rect1 = details.getBoundingClientRect();
  while (focusedDetails && !focusedDetails.contains(details)) {
    focusedDetails.open = false;
    focusedDetails = focusedDetails.parentElement.closest('details');
  }
  for (p = details.parentElement; p.tagName !== 'BODY'; p = p.parentElement) {
    if (p.tagName === 'DETAILS') p.open = true;
  }
  focusedDetails = details;

  setTimeout(() => { scrollLock = false; }, 500);

  if (scroll == 'center') {
    return details.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  const rect2 = details.getBoundingClientRect();

  // keep the top of the section at the same position
  var dy = 0;
  if (rect2.top < rect1.top && details.firstChild.firstChild.tagName === 'H2') {
    dy += rect2.bottom - rect1.top - 30;
    focusedDetails = details.lastChild.lastChild;
  }
  else if (rect2.bottom > window.innerHeight) {
    dy += Math.min(rect2.top, rect2.bottom - window.innerHeight);
  }

  if (Math.abs(dy) > 200) {
    window.scrollBy({ top: dy, behavior: 'smooth' });
  } else scrollLock = false;
}

function findNext(elm) {
  tag = elm.tagName;

  function getNextNode(node) {
    if (node.firstChild) return node.firstChild;
    while (node) {
      if (node.nextSibling) return node.nextSibling;
      node = node.parentNode;
    }
    return null;
  }

  let node = getNextNode(elm);

  while (node) {
    if (node.nodeType === 1 && node.tagName === tag) {
      return node;
    }
    node = getNextNode(node);
  }

  return null;
}

function findPrev(elm) {
  tag = elm.tagName;

  function getPreviousNode(node) {
    if (node.previousSibling) {
      node = node.previousSibling;
      while (node && node.lastChild) {
        node = node.lastChild;
      }
      return node;
    }
    return node.parentNode;
  }

  let node = getPreviousNode(elm);

  while (node) {
    if (node.nodeType === 1 && node.tagName === tag) {
      return node;
    }
    node = getPreviousNode(node);
  }

  return null;
}
