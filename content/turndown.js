async function AIReformat(document) {
  let container = document.querySelector('pre');
  let text = container.textContent;
  document.readyState === 'loading';

  try {
    const prompt = `Convert the following text provided by the user to a well-structured Markdown document. For large chunks of text, consider splitting them into smaller subsections. For each section of any level containing too much information for the user to easily digest, **write a brief summary under its header with prefix "> Summary: "**. Do your best to enable the user to clearly and quickly understand the whole document by traversing the document tree from root to leaves.`;
    const messageJson = {
      model: "gpt-4o-mini",
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: text },
      ],
      stream: true,
      // max_tokens: 2048,
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
    let markdown = '';
    let buf = '';

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
          // console.error('Error parsing JSON:', error);
        }
      }
      if (buf.length > 0) {
        console.error('Error parsing JSON:', buf);
      }
      container.textContent = markdown;
    }

    document.readyState === 'complete';
    return markdown;
  } catch (error) {
    console.error('Error with OpenAI API:', error);
    return 'Error generating Markdown content';
  }
}

async function mdwise() {
  await import('/vendor/turndown.min.js');
  const turndownService = new TurndownService();
  turndownService.remove(['script', 'style', 'input', 'textarea', 'form', 'noscript']);
  const markdown = turndownService.turndown(document.body);
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const win = window.open(URL.createObjectURL(blob), '_blank');
  win.onload = async () => {
    await AIReformat(win.document);
  }
}

mdwise();