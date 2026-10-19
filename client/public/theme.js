// Sets the theme before first paint so there is no flash of the wrong one. A file rather than an inline script, so
// the Content-Security-Policy can allow scripts from this site only.
try {
  var t = localStorage.getItem('theme');
  // Night City (dark) is the default look; light is opt-in from the toggle.
  if (t !== 'light' && t !== 'dark') t = 'dark';
  document.documentElement.dataset.theme = t;
} catch {
  // storage blocked (private window, strict settings): the dark default from the stylesheet stays
}
