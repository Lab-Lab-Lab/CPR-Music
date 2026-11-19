// Browser-only login, replacing NextAuth.
//
// The browser talks to Django's /auth-token/ directly:
//   POST   { username, password } -> { token }   (log in)
//   DELETE with "Authorization: Token ..."       (log out, revokes the token)
// The token is kept in localStorage so it survives reloads and new tabs.
//
// Everything that knows *where* the token lives is in this file, so switching
// to Django session cookies later only means changing this file.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

const STORAGE_KEY = 'musiccpr.auth';
const CHANGE_EVENT = 'musiccpr-auth-change';
const AUTH_URL = `${process.env.NEXT_PUBLIC_BACKEND_HOST}/auth-token/`;

export function getAuth() {
  if (typeof window === 'undefined') return null;
  try {
    const auth = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    return auth?.token ? auth : null;
  } catch {
    return null;
  }
}

function setAuth(auth) {
  if (auth) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  // 'storage' events only reach *other* tabs; tell this tab too.
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function getToken() {
  return getAuth()?.token ?? null;
}

// Throws an Error with a user-facing message if the login is rejected.
export async function login(username, password) {
  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new Error(
      res.status === 400
        ? 'Sign in failed. Check your login credentials.'
        : 'Unable to sign in.',
    );
  }
  const { token } = await res.json();
  setAuth({ token, username });
}

// Forget the token locally, and revoke it on the server if we can.
export async function logout() {
  const token = getToken();
  setAuth(null);
  if (!token) return;
  try {
    await fetch(AUTH_URL, {
      method: 'DELETE',
      headers: { Authorization: `Token ${token}` },
    });
  } catch {
    // Already logged out locally; a failed revoke shouldn't block that.
  }
}

// Clear a token the server no longer accepts, without calling the server.
export function clearAuth() {
  setAuth(null);
}

// Only allow approved in-site redirects.
// `allowedPaths` may contain exact paths (e.g. "/profile") or prefixes ending
// with "/" (e.g. "/projects/") to allow nested routes under that prefix.
export function safeCallbackUrl(url, fallback = '/', allowedPaths = ['/']) {
  const candidate = Array.isArray(url) ? url[0] : url;
  if (typeof candidate !== 'string' || !candidate) return fallback;

  try {
    const parsed = new URL(candidate, 'http://localhost');
    // Reject absolute/protocol-relative URLs and malformed values.
    if (parsed.origin !== 'http://localhost') return fallback;

    const normalized = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    const isAllowed = allowedPaths.some((allowed) =>
      allowed.endsWith('/')
        ? parsed.pathname.startsWith(allowed)
        : parsed.pathname === allowed,
    );

    return isAllowed ? normalized : fallback;
  } catch {
    return fallback;
  }
}

// Same return shape as NextAuth's useSession(), so callers barely change:
//   { status: 'loading' | 'authenticated' | 'unauthenticated',
//     data: { user: { name }, djangoToken } | null }
// With { required: true }, signed-out users are sent to the sign-in page.
export function useAuth({ required = false } = {}) {
  const router = useRouter();
  // Start as 'loading' so the server render and first client render match;
  // localStorage is only read after mount.
  const [auth, setAuthState] = useState(undefined);

  useEffect(() => {
    const sync = () => setAuthState(getAuth());
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener(CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(CHANGE_EVENT, sync);
    };
  }, []);

  let status = 'loading';
  if (auth) status = 'authenticated';
  else if (auth === null) status = 'unauthenticated';

  useEffect(() => {
    if (required && status === 'unauthenticated' && router.isReady) {
      router.replace({
        pathname: '/auth/signin',
        query: { callbackUrl: router.asPath },
      });
    }
  }, [required, status, router.isReady]);

  return {
    status,
    data: auth
      ? { user: { name: auth.username }, djangoToken: auth.token }
      : null,
  };
}
