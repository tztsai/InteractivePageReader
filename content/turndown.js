
//-------------------- OpenAI Summarization --------------------
async function AIReformat(text, win) {
    try {
      console.log('Generating Markdown content...');
  
      const prompt = `
        Convert the given page to a well-structured Markdown document. For large chunks of text, consider splitting them into smaller subsections. For each section of any level containing too much information for the user to easily digest, write a brief summary under its header in italic and with prefix "Summary: ". Do your best to enable the user to clearly and quickly understand the whole document by traversing the document tree from root to leaves.`;
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
  
      const container = win.document.createElement('pre');
      win.document.body.appendChild(container);
      var buf = '';
  
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
            console.error('Error parsing JSON:', buf);
          }
        }
        container.textContent = markdown;
      }
  
      return markdown;
    } catch (error) {
      console.error('Error with OpenAI API:', error);
      return 'Error generating Markdown content';
    }
  }
  
  //-------------------- Markdown Conversion --------------------
  if (typeof turndownScript === 'undefined') {
    const turndownScript = document.createElement('script');
    turndownScript.src = chrome.runtime.getURL('/vendor/turndown.min.js');
    document.head.appendChild(turndownScript);
  
    turndownScript.onload = async () => {
      await import(turndownScript.src);
  
      const turndownService = new TurndownService();
      turndownService.remove(['script', 'style']);
      var markdown = turndownService.turndown(document.documentElement);
      const win = window.open('', '_blank');
  
      await AIReformat(markdown, win);
    };
  }
  