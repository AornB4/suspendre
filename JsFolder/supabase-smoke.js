// Optional smoke test. Visit any page with ?debug=supabase to verify the client can read from the database.
document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('debug') !== 'supabase') return;

  const db = window.SUSPENDRE_SUPABASE;
  if (!db) {
    console.error('[Supabase] Shared client module is not loaded.');
    return;
  }

  const result = await db.smokeTest();

  if (result.ok) {
    console.info('[Supabase]', result.message, result.sample);
    if (typeof showToast === 'function') {
      showToast('Supabase connection verified.', 'success', 4000);
    }
    return;
  }

  console.error('[Supabase]', result.message, result.error || '');
  if (typeof showToast === 'function') {
    showToast(`Supabase check failed: ${result.message}`, 'error', 5000);
  }
});
