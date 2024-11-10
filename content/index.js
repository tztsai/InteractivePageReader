var $ = document.querySelector.bind(document)

var state = {
  theme: args.theme,
  raw: args.raw,
  themes: args.themes,
  content: args.content,
  compiler: args.compiler,
  custom: args.custom,
  icon: args.icon,
  html: '',
  markdown: '',
  toc: '',
  reload: {
    interval: null,
    ms: 1000,
    md: false,
  },
  _themes: {
    'github': 'light',
    'github-dark': 'dark',
    'almond': 'light',
    // 'air': 'light',
    'awsm': 'light',
    'axist': 'light',
    'bamboo': 'auto',
    'bullframe': 'light',
    'holiday': 'auto',
    'kacit': 'light',
    'latex': 'light',
    'marx': 'light',
    'mini': 'light',
    'modest': 'light',
    'new': 'auto',
    'no-class': 'auto',
    'pico': 'auto',
    'retro': 'dark',
    'sakura': 'light',
    'sakura-vader': 'dark',
    'semantic': 'light',
    'simple': 'auto',
    // 'splendor': 'light',
    'style-sans': 'light',
    'style-serif': 'light',
    'stylize': 'light',
    'superstylin': 'auto',
    'tacit': 'light',
    'vanilla': 'auto',
    'water': 'light',
    'water-dark': 'dark',
    'writ': 'light',
    'custom': 'auto',
  }
}

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.message === 'reload') {
    location.reload(true)
  }
  else if (req.message === 'theme') {
    state.theme = req.theme
    m.redraw()
  }
  else if (req.message === 'themes') {
    state.themes = req.themes
    m.redraw()
  }
  else if (req.message === 'raw') {
    state.raw = req.raw
    state.reload.md = true
    m.redraw()
  }
  else if (req.message === 'autoreload') {
    clearInterval(state.reload.interval)
  }
})

var oncreate = {
  html: () => {
    update()
  }
}

var onupdate = {
  html: () => {
    if (state.reload.md) {
      state.reload.md = false
      update(true)
    }
  },
  theme: () => {
    if (state.content.mermaid) {
      setTimeout(() => mmd.render(), 0)
    }
  }
}

var update = (update) => {
  document.readyState = 'interactive';

  scroll(update)

  if (state.content.toc) {
    toc = document.getElementById('_toc');
    toc && toc.querySelectorAll('a').forEach((el) => {
      el.addEventListener('click', (e) => {
        h = document.getElementById(e.target.getAttribute('href').slice(1))
        d = h.parentElement.parentElement;
        if (d.tagName === 'DETAILS') {
          d.open = true;
        }
      })
    })
  }

  if (state.content.syntax) {
    setTimeout(() => Prism.highlightAll(), 20)
  }

  if (state.content.mermaid) {
    setTimeout(() => mmd.render(), 40)
  }

  if (state.content.mathjax) {
    setTimeout(() => mj.render(), 60)
  }

  // Add details & summary tags to each section separated by headers
  setTimeout(makeFoldable, 80);
}

var makeFoldable = (selector = 'h1, h2, h3, h4, h5') => {
  document.querySelectorAll(selector).forEach(header => {
    const parent = header.parentNode;
    if (parent.tagName === 'SUMMARY') return;

    const details = document.createElement('details');

    if (header.tagName <= 'H3') {
      details.id = 'id-' + Math.random().toString(36).substring(2, 7);
    }

    const div = document.createElement('div');
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
    details.insertAdjacentElement('afterbegin', header);

    // Expand a details element when hovering over it
    header.addEventListener('mouseenter', () => {
      !scrollLock && focusOnDetails(details);
    });
    // details.addEventListener('click', () => {
    //   focusedDetails = details;
    // });
  });
  document.readyState = 'complete';
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
  isDownward = true;
  isNewSection = false;
  details.open = true;

  const rect1 = details.getBoundingClientRect();
  while (focusedDetails && !focusedDetails.contains(details)) {
    if (focusedDetails.getBoundingClientRect().top > rect1.top)
      isDownward = false;
    if (details.firstChild.firstChild < focusedDetails.firstChild.firstChild)
      isNewSection = true;
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
  dy = rect2.top - rect1.top;
  if (isNewSection && isDownward) {
    // dy += rect2.height + 30;
    // focusedDetails = details.nextElementSibling;
  }
  else if (isDownward) {  // move towards the end of the block
    dy += Math.max(Math.min(rect1.top, rect1.height - 50), 0);
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

var render = (md) => {
  state.markdown = md
  chrome.runtime.sendMessage({
    message: 'markdown',
    compiler: state.compiler,
    markdown: frontmatter(state.markdown)
  }, (res) => {
    if (res.err) return;
    state.html = res.html
    if (state.content.emoji) {
      state.html = emojinator(state.html)
    }
    if (state.content.mermaid) {
      state.html = state.html.replace(
        /<code class="language-(?:mermaid|mmd)">/gi,
        '<code class="mermaid">'
      )
    }
    if (state.content.toc) {
      state.toc = toc.render(state.html)
    }
    state.html = anchors(state.html)
    m.redraw()
  })
}

function mount() {
  $('pre').style.display = 'none'
  var md = $('pre').innerText
  favicon()

  m.mount($('body'), {
    oninit: () => {
      render(md)
    },
    view: () => {
      var dom = []

      if (state.html) {
        state._themes.custom = state.custom.color

        var color =
          state._themes[state.theme] === 'dark' ||
            (state._themes[state.theme] === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
            ? 'dark' : 'light'

        $('body').classList.remove(...Array.from($('body').classList).filter((name) => /^_theme|_color/.test(name)))
        dom.push(m('link#_theme', {
          onupdate: onupdate.theme,
          rel: 'stylesheet', type: 'text/css',
          href: state.theme !== 'custom' ? chrome.runtime.getURL(`/themes/${state.theme}.css`) : '',
        }))
        $('body').classList.add(`_theme-${state.theme}`, `_color-${color}`)

        if (state.content.syntax) {
          dom.push(m('link#_prism', {
            rel: 'stylesheet', type: 'text/css',
            href: chrome.runtime.getURL(`/vendor/${color === 'dark' ? 'prism-okaidia' : 'prism'}.min.css`),
          }))
        }

        var theme =
          (/github(-dark)?/.test(state.theme) ? 'markdown-body' : 'markdown-theme') +
          (state.themes.width !== 'auto' ? ` _width-${state.themes.width}` : '')

        if (state.raw) {
          if (state.content.syntax) {
            dom.push(m('#_markdown', { oncreate: oncreate.html, onupdate: onupdate.html, class: theme },
              m.trust(`<pre class="language-md"><code class="language-md">${_escape(state.markdown)}</code></pre>`)
            ))
          }
          else {
            dom.push(m('pre#_markdown', { oncreate: oncreate.html, onupdate: onupdate.html }, state.markdown))
          }
        }
        else {
          dom.push(m('#_html', { oncreate: oncreate.html, onupdate: onupdate.html, class: theme },
            m.trust(state.html)
          ))
        }

        if (state.content.toc) {
          dom.push(m('#_toc.tex2jax-ignore', m.trust(state.toc)))
          state.raw ? $('body').classList.remove('_toc-left') : $('body').classList.add('_toc-left')
        }

        if (state.theme === 'custom') {
          dom.push(m('style', { type: 'text/css' }, state.custom.theme))
        }
      }

      return dom
    }
  })
}

var anchors = (html) =>
  html.replace(/(<h[1-6] id="(.*?)">)/g, (header, _, id) =>
    header +
    '<a class="anchor" name="' + id + '" href="#' + id + '">' +
    '<span class="octicon octicon-link"></span></a>'
  )

var toc = (() => {
  var walk = (regex, string, group, result = [], match = regex.exec(string)) =>
    !match ? result : walk(regex, string, group, result.concat(!group ? match[1] :
      group.reduce((all, name, index) => (all[name] = match[index + 1], all), {})))
  return {
    render: (html) =>
      walk(
        /<h([1-6]) id="(.*?)">(.*?)<\/h[1-6]>/gs,
        html,
        ['level', 'id', 'title']
      )
        .reduce((toc, { id, title, level }) => toc +=
          '<div class="_ul">'.repeat(level) +
          '<a href="#' + id + '">' + title.replace(/<a[^>]+>/g, '').replace(/<\/a>/g, '') + '</a>' +
          '</div>'.repeat(level)
          , '')
  }
})()

var frontmatter = (md) => {
  if (/^-{3}[\s\S]+?-{3}/.test(md)) {
    var [, yaml] = /^-{3}([\s\S]+?)-{3}/.exec(md)
    var title = /title: (?:'|")*(.*)(?:'|")*/.exec(yaml)
    title && (document.title = title[1])
  }
  else if (/^\+{3}[\s\S]+?\+{3}/.test(md)) {
    var [, toml] = /^\+{3}([\s\S]+?)\+{3}/.exec(md)
    var title = /title = (?:'|"|`)*(.*)(?:'|"|`)*/.exec(toml)
    title && (document.title = title[1])
  }
  return md.replace(/^(?:-|\+){3}[\s\S]+?(?:-|\+){3}/, '')
}

var favicon = () => {
  var favicon = document.createElement('link')
  favicon.rel = 'icon'
  favicon.href = chrome.runtime.getURL(`/icons/${state.icon}/16x16.png`)
  $('head').appendChild(favicon)
}

var _escape = (str) =>
  str.replace(/[&<>]/g, (tag) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;'
  }[tag] || tag))


if (document.readyState === 'complete') {
  mount()
}
else {
  var timeout = setInterval(() => {
    if (document.readyState === 'complete') {
      clearInterval(timeout)
      mount()
    }
  }, 0)
}
