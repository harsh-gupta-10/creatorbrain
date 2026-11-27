document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const link = event.target.closest('[data-block]');
  if (!link) return;

  const id = link.getAttribute('data-block');
  if (!id) return;

  const endpoint = `/api/bio/click/${encodeURIComponent(id)}`;
  if (navigator.sendBeacon) {
    navigator.sendBeacon(endpoint);
  } else {
    fetch(endpoint, { method: 'POST', keepalive: true }).catch(() => {});
  }
});
