(function () {
  const STORAGE_KEY = 'mediapull.auth.user';
  const NONCE_KEY = 'mediapull.auth.nonce';
  const AUTH_ENDPOINT = '/api/auth/google';
  const FALLBACK_CLIENT_ID = '692852964677-rtuf4dqbiee6855dkn5icmash15e34s7.apps.googleusercontent.com';
  const GSI_BUTTON = {
    theme: 'filled_black',
    size: 'medium',
    type: 'standard',
    shape: 'pill',
    text: 'signin_with',
    logo_alignment: 'left',
    locale: 'tr'
  };

  let googleClientId = FALLBACK_CLIENT_ID;
  let authGeneration = 0;

  const authSlot = document.getElementById('authSlot');
  const signedOut = document.getElementById('authSignedOut');
  const signedIn = document.getElementById('authSignedIn');
  const userAvatar = document.getElementById('userAvatar');
  const userName = document.getElementById('userName');
  const userEmail = document.getElementById('userEmail');
  const userLicense = document.getElementById('userLicense');
  const btnSignOut = document.getElementById('btnSignOut');
  const authError = document.getElementById('authError');

  function randomNonce() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  function readUser() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const user = JSON.parse(raw);
      if (!user || typeof user.email !== 'string') return null;
      return user;
    } catch {
      return null;
    }
  }

  function saveUser(user) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      name: user.name,
      email: user.email,
      picture: user.picture,
      isPro: Boolean(user.isPro)
    }));
  }

  function clearUser() {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(NONCE_KEY);
  }

  function showError(message) {
    if (!authError) return;
    authError.textContent = message || '';
    authError.hidden = !message;
  }

  function renderUser(user) {
    const signed = Boolean(user && user.email);
    document.body.classList.toggle('is-signed-in', signed);
    document.body.classList.toggle('is-pro', signed && Boolean(user.isPro));

    if (signedOut) signedOut.hidden = signed;
    if (signedIn) signedIn.hidden = !signed;
    if (authSlot) authSlot.dataset.state = signed ? 'in' : 'out';

    if (!signed) return;

    if (userAvatar) {
      userAvatar.src = user.picture || '';
      userAvatar.alt = user.name || user.email;
      userAvatar.hidden = !user.picture;
    }
    if (userName) userName.textContent = user.name || user.email;
    if (userEmail) userEmail.textContent = user.email;
    if (userLicense) {
      userLicense.textContent = user.isPro ? 'PRO' : 'Free';
      userLicense.classList.toggle('pro', Boolean(user.isPro));
      userLicense.classList.toggle('free', !user.isPro);
    }
  }

  async function fetchClientId() {
    try {
      const res = await fetch(AUTH_ENDPOINT, { method: 'GET', headers: { Accept: 'application/json' } });
      if (res.ok) {
        const data = await res.json();
        if (data && data.clientId) return data.clientId;
      }
    } catch {
      /* statik önizlemede API yok; public client id ile buton yine açılır */
    }
    return FALLBACK_CLIENT_ID;
  }

  function whenGoogleReady() {
    return new Promise((resolve, reject) => {
      if (window.google && google.accounts && google.accounts.id) {
        resolve();
        return;
      }
      const started = Date.now();
      const timer = setInterval(() => {
        if (window.google && google.accounts && google.accounts.id) {
          clearInterval(timer);
          resolve();
          return;
        }
        if (Date.now() - started > 10000) {
          clearInterval(timer);
          reject(new Error('gsi_timeout'));
        }
      }, 50);
    });
  }

  function gsi() {
    return window.google && google.accounts && google.accounts.id ? google.accounts.id : null;
  }

  function renderGoogleButton() {
    const id = gsi();
    const buttonHost = document.getElementById('g_id_signin');
    if (!id || !buttonHost) return;
    buttonHost.innerHTML = '';
    id.renderButton(buttonHost, GSI_BUTTON);
  }

  async function handleCredentialResponse(response) {
    showError('');
    const credential = response && response.credential;
    if (!credential) {
      showError('Google kimliği alınamadı.');
      return;
    }

    try {
      const nonce = sessionStorage.getItem(NONCE_KEY) || '';
      const res = await fetch(AUTH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ credential, nonce })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.user) {
        const map = {
          invalid_token: 'Google oturumu doğrulanamadı.',
          unverified_email: 'E-posta Google tarafından doğrulanmamış.',
          missing_credential: 'Kimlik belirteci eksik.',
          invalid_nonce: 'Oturum doğrulaması başarısız. Tekrar dene.'
        };
        throw new Error(map[data.error] || 'Giriş başarısız.');
      }
      authGeneration += 1;
      saveUser(data.user);
      renderUser(data.user);
      const id = gsi();
      if (id) id.cancel();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Giriş başarısız.');
    }
  }

  window.handleCredentialResponse = handleCredentialResponse;

  function bindOnload(clientId) {
    const onload = document.getElementById('g_id_onload');
    if (!onload) return;
    onload.setAttribute('data-client_id', clientId);
    onload.setAttribute('data-callback', 'handleCredentialResponse');
    onload.setAttribute('data-auto_prompt', 'false');
    onload.setAttribute('data-auto_select', 'false');
    onload.setAttribute('data-context', 'signin');
    onload.setAttribute('data-ux_mode', 'popup');
    onload.setAttribute('data-itp_support', 'true');
    onload.setAttribute('data-use_fedcm_for_prompt', 'true');
  }

  async function initGoogle(clientId) {
    googleClientId = clientId;
    await whenGoogleReady();
    const nonce = randomNonce();
    sessionStorage.setItem(NONCE_KEY, nonce);
    bindOnload(clientId);

    gsi().initialize({
      client_id: clientId,
      callback: handleCredentialResponse,
      nonce,
      auto_select: false,
      cancel_on_tap_outside: true,
      context: 'signin',
      ux_mode: 'popup',
      itp_support: true,
      use_fedcm_for_prompt: true
    });

    renderGoogleButton();

    if (!readUser()) {
      gsi().prompt();
    }
  }

  function signOut() {
    authGeneration += 1;
    clearUser();
    renderUser(null);
    showError('');

    const id = gsi();
    if (id) {
      try { id.cancel(); } catch (_) {}
      try { id.disableAutoSelect(); } catch (_) {}
    }

    requestAnimationFrame(function () {
      renderGoogleButton();
    });
  }

  async function refreshLicense(user, generation) {
    if (!user || !user.email) return user;
    try {
      const res = await fetch('/api/auth/license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: user.email })
      });
      const data = await res.json().catch(() => ({}));
      if (generation !== authGeneration) return user;
      if (!readUser() || readUser().email !== user.email) return user;
      if (!res.ok || !data.success) return user;
      const next = { ...user, isPro: Boolean(data.isPro) };
      saveUser(next);
      renderUser(next);
      return next;
    } catch {
      return user;
    }
  }

  if (btnSignOut) btnSignOut.addEventListener('click', signOut);

  const existing = readUser();
  renderUser(existing);
  refreshLicense(existing, authGeneration);

  fetchClientId()
    .then(initGoogle)
    .catch((err) => {
      console.warn('[auth] Google SSO hazır değil:', err instanceof Error ? err.message : err);
      if (!readUser()) {
        showError('Google girişi şu an kullanılamıyor.');
      }
    });
})();
