(function () {
  'use strict';

  var CONSENT_KEY = 'devignite_cookie_consent';
  var ACCEPTED = 'accepted';
  var DECLINED = 'declined';

  function getStoredConsent() {
    try {
      return window.localStorage.getItem(CONSENT_KEY);
    } catch (e) {
      return null;
    }
  }

  function setStoredConsent(value) {
    try {
      window.localStorage.setItem(CONSENT_KEY, value);
    } catch (e) {
      // ignore (storage blocked)
    }
  }

  function disableReb2b() {
    removeReb2bScripts();
    if (window.reb2b && typeof window.reb2b === 'object') {
      window.reb2b.disabled = true;
    }
  }

  function enableReb2b() {
    if (typeof window.__loadReb2b === 'function') {
      window.__loadReb2b();
    }
  }

  function removeReb2bScripts() {
    try {
      var scripts = document.querySelectorAll('script[src*="ddwl4m2hdecbv.cloudfront.net/b/"]');
      scripts.forEach(function (script) {
        if (script && script.parentNode) {
          script.parentNode.removeChild(script);
        }
      });
    } catch (e) {
      // ignore
    }
  }

  function hideBanner(banner) {
    banner.hidden = true;
    banner.setAttribute('aria-hidden', 'true');
  }

  function showBanner(banner) {
    banner.hidden = false;
    banner.setAttribute('aria-hidden', 'false');
  }

  function initCookieBanner() {
    var banner = document.getElementById('cookie-banner');
    if (!banner) return;

    var consent = getStoredConsent();
    if (consent === ACCEPTED || consent === DECLINED) {
      hideBanner(banner);
      return;
    }

    showBanner(banner);

    var acceptBtn = banner.querySelector('[data-cookie-accept]');
    var declineBtn = banner.querySelector('[data-cookie-decline]');

    if (acceptBtn) {
      acceptBtn.addEventListener('click', function () {
        setStoredConsent(ACCEPTED);
        hideBanner(banner);

        enableReb2b();
      });
    }

    if (declineBtn) {
      declineBtn.addEventListener('click', function () {
        setStoredConsent(DECLINED);
        disableReb2b();

        hideBanner(banner);
      });
    }
  }

  function renderConsentStatus(statusEl) {
    var consent = getStoredConsent();
    if (consent === ACCEPTED) statusEl.textContent = 'Accepted';
    else if (consent === DECLINED) statusEl.textContent = 'Declined';
    else statusEl.textContent = 'Not set';
  }

  function initCookiePreferencesPage() {
    var cmtRoot = document.querySelector('[data-cookie-cmt]');
    if (!cmtRoot) return;

    var statusEl = document.getElementById('cookie-consent-status');
    if (statusEl) renderConsentStatus(statusEl);

    var acceptBtn = cmtRoot.querySelector('[data-cookie-cmt-accept]');
    var declineBtn = cmtRoot.querySelector('[data-cookie-cmt-decline]');

    if (acceptBtn) {
      acceptBtn.addEventListener('click', function () {
        setStoredConsent(ACCEPTED);
        if (statusEl) renderConsentStatus(statusEl);
        enableReb2b();
      });
    }

    if (declineBtn) {
      declineBtn.addEventListener('click', function () {
        setStoredConsent(DECLINED);
        if (statusEl) renderConsentStatus(statusEl);
        disableReb2b();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initCookieBanner();
      initCookiePreferencesPage();
    });
  } else {
    initCookieBanner();
    initCookiePreferencesPage();
  }
})();
