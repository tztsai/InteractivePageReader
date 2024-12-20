
md.inject = ({ storage: { state } }) => (id) => {

  chrome.scripting.executeScript({
    target: { tabId: id },
    args: [{
      theme: state.theme,
      raw: state.raw,
      themes: state.themes,
      content: state.content,
      compiler: state.compiler,
      custom: state.custom,
      icon: state.settings.icon,
    }],
    func: (_args) => {
      console.warn('Injecting content script')
      args = _args
      pre = document.querySelector('pre');
      if (pre) {
        pre.style.visibility = 'hidden'
      }
    },
    injectImmediately: true
  })

  chrome.scripting.insertCSS({
    target: { tabId: id },
    files: [
      '/content/index.css',
      '/content/themes.css',
    ]
  })

  chrome.scripting.executeScript({
    target: { tabId: id },
    files: [
      '/vendor/mithril.min.js',
      '/vendor/readability.min.js',
      '/vendor/turndown.min.js',
      state.content.syntax && ['/vendor/prism.min.js', '/vendor/prism-autoloader.min.js', '/content/prism.js'],
      state.content.emoji && '/content/emoji.js',
      state.content.mermaid && ['/vendor/mermaid.min.js', '/vendor/panzoom.min.js', '/content/mermaid.js'],
      // state.content.mathjax && ['/content/mathjax.js', '/vendor/mathjax/tex-mml-chtml.js'],
      '/content/mdwise.js',
      '/content/index.js',
      '/content/scroll.js',
      state.content.autoreload && '/content/autoreload.js',
    ].filter(Boolean).flat(),
    injectImmediately: true
  })

}
