/**
 * ─── AUTH MODULE ─────────────────────────────────────────────
 * Handles User Login, Signup, and Session Management.
 * ───────────────────────────────────────────────────────────── */

const Auth = (() => {
  let currentUser = null;

  const setCookie = (name, value, days) => {
    let expires = "";
    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (JSON.stringify(value) || "") + expires + "; path=/; SameSite=Lax";
  }

  const getCookie = (name) => {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for(let i=0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) == ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) == 0) return JSON.parse(c.substring(nameEQ.length, c.length));
    }
    return null;
  }

  const eraseCookie = (name) => {
    document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
  }

  const init = () => {
    // Check if user is already logged in (Remember Me)
    const cached = localStorage.getItem('azura_user') || getCookie('azura_user');
    if (cached) {
      currentUser = typeof cached === 'string' ? JSON.parse(cached) : cached;
      // Re-sync cookie and localStorage
      setUser(currentUser);
      return currentUser;
    }
    return null;
  };

  const signup = async (name, email, password) => {
    try {
      const resp = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Signup failed');
      return data.user;
    } catch (err) {
      console.error('Signup error:', err);
      throw err;
    }
  };

  const login = async (email, password, remember = false) => {
    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Login failed');

      if (remember) {
        setUser(data.user);
      } else {
        currentUser = data.user;
        sessionStorage.setItem('azura_user', JSON.stringify(data.user));
      }
      
      return data.user;
    } catch (err) {
      console.error('Login error:', err);
      throw err;
    }
  };

  const logout = () => {
    currentUser = null;
    localStorage.removeItem('azura_user');
    sessionStorage.removeItem('azura_user');
    eraseCookie('azura_user');
    window.location.reload();
  };

  const setUser = (user) => {
    currentUser = user;
    localStorage.setItem('azura_user', JSON.stringify(user));
    setCookie('azura_user', user, 30); // Persistent for 30 days
  };

  const getUser = () => {
    if (currentUser) return currentUser;
    const session = sessionStorage.getItem('azura_user');
    return session ? JSON.parse(session) : (getCookie('azura_user') || null);
  };

  return {
    init, signup, login, logout, getUser, setUser
  };
})();
