importScripts('/vendor/markdown-it.min.js')
importScripts('/vendor/marked.min.js')
importScripts('/vendor/remark.min.js')
importScripts('/vendor/turndown.min.js')
importScripts('/vendor/readability.min.js')
importScripts('/background/compilers/markdown-it.js')
importScripts('/background/compilers/marked.js')
importScripts('/background/compilers/remark.js')

importScripts('/background/storage.js')
importScripts('/background/webrequest.js')
importScripts('/background/detect.js')
importScripts('/background/inject.js')
importScripts('/background/messages.js')
importScripts('/background/mathjax.js')
importScripts('/background/xhr.js')
importScripts('/background/icon.js')

;(() => {
  var storage = md.storage(md)
  var inject = md.inject({storage})
  var detect = md.detect({storage, inject})
  var webrequest = md.webrequest({storage})
  var mathjax = md.mathjax()
  var xhr = md.xhr()
  var icon = md.icon({storage})

  var compilers = Object.keys(md.compilers)
    .reduce((all, compiler) => (
      all[compiler] = md.compilers[compiler]({storage}),
      all
    ), {})

  var messages = md.messages({storage, compilers, mathjax, xhr, webrequest, icon})

  chrome.tabs.onUpdated.addListener(detect.tab)
  chrome.runtime.onMessage.addListener(messages)

  var mdWise = (tab) => {
    inject(tab.id);
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["/content/mdwise.js", "/content/index.js"]
    })
  }
  
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: "md-wise",
      title: "Too Long Read It Short",
      contexts: ["page"]
    });
  });
  
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "md-wise") mdWise(tab);
  });

  chrome.commands.onCommand.addListener((command) => {
    if (command === "md-wise") {
      chrome.tabs.query({active: true, currentWindow: true}, ([tab]) => {
        if (tab) mdWise(tab);
      });
    }
  });

  icon()
})()
