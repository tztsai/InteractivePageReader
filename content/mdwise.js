function cleanHtml() {
  if (main = document.querySelector('main')) {
    document.body.innerHTML = main.innerHTML;
  }
  let articles = document.querySelectorAll('article');
  if (articles.length) {
    document.body.innerHTML = '';
    for (e of articles) {
      if (e.textContent.trim().length > 20) {
        document.body.appendChild(e);
      }
    }
  }
  document.querySelectorAll(
    'link, style, script, meta, noscript, header, nav, span, footer, figure, table'
  ).forEach(e => e.remove());
}

async function generateSummaries(html) {
  const prompt = `For each header element with an ID in the provided HTML document, generate a concise summary of its corresponding content (if it's too long to read quickly). You can include <a> links in your summary that reference other relevant headers or external sources within the document.

  Each summary should strictly follow the format \`#ID: Summary\`, with each one separated by **two new lines**. Ensure there are no unnecessary HTML tags or triple backticks in your response. Never put two summaries in the same line.

  **Examples:**

  #a-h2-header: A brief summary of the content within <h2 id="a-h2-header">...</h2>.

  #a-h3-header: Summary of #a-h3-header. Refer to <a href="#another-header">Another Header</a>.
  `

  function compress(html) {
    let key = html.tagName;
    if (key.match(/^H[1-6]$/)) {
      return `<${key} id="${html.id}">${html.textContent}</${key}>`;
    } if (html.children.length) {
      return Array.from(html.children).map(compress).join('');
    } else {
      return html.textContent;
    }
  }

  const content = compress(html);

  const fillSummary = (output, done) => {
    // output = output.replace(/\s*```\s*[a-z]*\s*/g, '');
    splits = output.trim().split(/\n{2,}/);
    var i = 0;
    while (i < splits.length - !done) {
      if (!splits[i].trim()) break;
      try {
        const [_, id, txt] = splits[i].match(/\s*#((?:\w|-)+): ([\s\S]+(?!\n#))/m)
        const d = document.getElementById(id);
        if (d) {
          writeSummary(d, txt);
        } else {
          console.error('Invalid ID:', id)
        }
        i += 1;
      } catch (error) {
        console.error('Invalid format:', error, splits[i]);
        break;
      }
    }
    if (done && splits.length > 1)
      console.error('Error parsing:', output);
    return splits.slice(i).join('\n\n');
  }

  await getAIResponse(content, prompt, fillSummary);
};

function writeSummary(header, txt) {
  const summary = header.parentElement;

  if (summary.querySelector('p')) {  // only keep the header
    summary.innerHTML = summary.firstChild.outerHTML;
  }

  p = document.createElement('p');
  summary.appendChild(p);
  
  chrome.runtime.sendMessage(
    { message: 'markdown', markdown: txt.trim() },
    (res) => {
      p.innerHTML = res.html || txt.trim();
    }
  );

  const qa = document.createElement('div');
  qa.className = 'ai-qa';
  qa.style.display = 'none';
  summary.appendChild(qa);

  function createInput() {
    const input = document.createElement('input');
    input.placeholder = 'Ask AI';
    qa.insertAdjacentElement('afterbegin', input);

    input.addEventListener('keydown', async (e) => {
      scrollLock = true;

      e.stopPropagation();
      if (e.key === ' ') {
        e.preventDefault(); input.value += ' ';
      }

      if (e.key === 'Enter' && input.value.trim()) {
        // remove all siblings following the input
        while (input.previousElementSibling)
          input.previousElementSibling.remove();
        if (qa.querySelector('p'))
          qa.querySelector('p').remove();

        const question = input.value.trim();
        const prompt = `Write a short answer given the following information:
          ${header.textContent}`;

        const ans = document.createElement('p');
        qa.insertBefore(ans, input.nextElementSibling);

        await getAIResponse(question, prompt,
          (output, _) => {
            chrome.runtime.sendMessage(
              { message: 'markdown', markdown: output },
              (res) => {
                ans.innerHTML = res.html || output;
              }
            );
            return output;
          });

        createInput();
        update();  // render the new content
        scrollLock = false;
      }
    });
    return input;
  }

  summary.addEventListener('mouseenter', () => {
    qa.style.display = 'block';
  });
  summary.addEventListener('mouseleave', () => {
    if (scrollLock) return;
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

  // console.warn('Generation started.\nQuery:', text.slice(0, 500),
  //   '\nPrompt:', prompt.slice(0, 500));

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
  })

  focusOnDetails(document.querySelector('details'));
}

var focusedDetails;
var scrollLock = false;

var focusOnDetails = (details) => {
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

  setTimeout(() => { scrollLock = false; }, 200);

  const rect2 = details.getBoundingClientRect();

  // keep the top of the section at the same position
  var dy = 0;
  if ((!focusedDetails || rect2.top < rect1.top) &&
    details.firstChild.firstChild.tagName === 'H2') {
    dy += Math.min(rect2.top, rect2.height) - 10;
  }
  // else if (rect2.bottom > window.innerHeight) {
  //   dy += Math.min(rect2.top, rect2.bottom - window.innerHeight + 10);
  // }

  if (Math.abs(dy) > 50) {
    window.scrollBy({ top: dy, behavior: 'smooth' });
  } else scrollLock = false;

  focusedDetails = details;
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

function makeAIButton() {
  const btn = document.createElement('button');
  btn.id = 'ai-summary-btn';
  btn.innerText = 'AI Summary';
  btn.style.position = 'fixed';
  btn.style.bottom = '20px';
  btn.style.right = '20px';
  btn.style.zIndex = '1000';
  btn.style.backgroundColor = '#007bff';
  btn.style.color = 'white';
  btn.style.border = 'none';
  btn.style.padding = '10px 20px';
  btn.style.borderRadius = '5px';
  btn.style.cursor = 'pointer';

  btn.onclick = () => {
    generateSummaries(document.getElementById('_html'));
  };

  btn.onmousedown = (e) => {
    e.preventDefault();
    let shiftX = e.clientX - btn.getBoundingClientRect().left;
    let shiftY = e.clientY - btn.getBoundingClientRect().top;

    function moveAt(pageX, pageY) {
      let newX = pageX - shiftX;
      let newY = pageY - shiftY;

      // Ensure the button stays within the viewport
      const rightEdge = document.documentElement.clientWidth - btn.offsetWidth;
      const bottomEdge = document.documentElement.clientHeight - btn.offsetHeight;

      if (newX < 0) newX = 0;
      if (newY < 0) newY = 0;
      if (newX > rightEdge) newX = rightEdge;
      if (newY > bottomEdge) newY = bottomEdge;

      btn.style.left = newX + 'px';
      btn.style.top = newY + 'px';
    }

    function onMouseMove(e) {
      moveAt(e.pageX, e.pageY);
    }

    document.addEventListener('mousemove', onMouseMove);

    btn.onmouseup = () => {
      document.removeEventListener('mousemove', onMouseMove);
      btn.onmouseup = null;
    };
  };

  btn.ondragstart = () => false;
  document.body.appendChild(btn);
}
