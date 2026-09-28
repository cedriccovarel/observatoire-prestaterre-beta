(() => {
  'use strict';
  const AUTH_KEY = 'prestaterre-observatoire-v21-auth';
  const EXPECTED_HASHES = new Set(['da7c267c72f7e0d4000e79268cc35c8dbf2054171d87096ebc2c61d0e193b0e8', 'e3a561f9cb2a9bc267524a2497a6d67313639618009c4b2584a10dcb157e0125']);
  const body = document.body;
  const screen = document.getElementById('authScreen');
  const shell = document.getElementById('appShell');
  const form = document.getElementById('authForm');
  const input = document.getElementById('authPassword');
  const error = document.getElementById('authError');
  const toggle = document.getElementById('authToggle');

  function grantAccess() {
    try { sessionStorage.setItem(AUTH_KEY, '1'); } catch (_) {}
    body.classList.remove('auth-locked');
    body.classList.add('auth-granted');
    body.style.removeProperty('overflow');
    if (screen) {
      screen.setAttribute('aria-hidden', 'true');
      screen.hidden = true;
      screen.style.setProperty('display', 'none', 'important');
      screen.style.setProperty('visibility', 'hidden', 'important');
      screen.style.setProperty('pointer-events', 'none', 'important');
      // Retire complètement l'écran de connexion après authentification afin
      // qu'aucun ancien CSS mis en cache ne puisse le réafficher en bandeau.
      requestAnimationFrame(() => {
        if (screen.isConnected) screen.remove();
      });
    }
    if (shell) {
      shell.setAttribute('aria-hidden', 'false');
      shell.style.setProperty('visibility', 'visible', 'important');
      shell.style.setProperty('pointer-events', 'auto', 'important');
    }
    setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
  }

  async function sha256(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  try {
    if (sessionStorage.getItem(AUTH_KEY) === '1') grantAccess();
  } catch (_) {}

  toggle?.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    toggle.textContent = show ? 'Masquer' : 'Afficher';
    input.focus();
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.textContent = '';
    const value = input.value || '';
    try {
      if (!window.crypto?.subtle) throw new Error('Web Crypto indisponible');
      const digest = await sha256(value);
      if (EXPECTED_HASHES.has(digest)) {
        input.value = '';
        grantAccess();
      } else {
        error.textContent = 'Mot de passe incorrect.';
        input.select();
      }
    } catch (e) {
      error.textContent = 'Impossible de vérifier le mot de passe dans ce navigateur.';
    }
  });
})();
