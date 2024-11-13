
md.icon = ({storage: {state}}) => () => {

  setTimeout(() =>
    chrome.action.setIcon({
      path: [16, 32, 64].reduce((all, size) => (
        all[size] = `/icons/${state.settings.icon}/${size}x${size}.png`,
        all
      ), {})
    })
  , 100)
}
