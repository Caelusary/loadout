import { removeBackground } from '@imgly/background-removal';

// Background removal, off the page. The library needs eval, which the site's Content-Security-Policy forbids; a
// worker gets its policy from its own file's headers (vercel.json gives this file a looser one), so the page keeps
// the strict policy and the eval stays in here, with no access to the page. Receives { id, file, config }; answers
// with progress messages, then { id, blob } or { id, error }.
self.onmessage = async ({ data: { id, file, config } }) => {
  try {
    const blob = await removeBackground(file, {
      ...config,
      progress: (key, current, total) => self.postMessage({ id, progress: { key, current, total } }),
    });
    self.postMessage({ id, blob });
  } catch (err) {
    self.postMessage({ id, error: String(err?.message ?? err) });
  }
};
