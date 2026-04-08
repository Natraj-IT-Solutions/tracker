/**
 * ─── AUTH MODULE ─────────────────────────────────────────────
 * Handles User Login, Signup, and Session Management.
 * ───────────────────────────────────────────────────────────── */

const Auth = (() => {
  let currentUser = null;

  const init = () => {
    // Check if user is already logged in (Remember Me)
    const cached = localStorage.getItem('azura_user');
    if (cached) {
      currentUser = JSON.parse(cached);
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
      
      // We don't auto-login for signup anymore because approval is needed
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
    window.location.reload();
  };

  const setUser = (user) => {
    currentUser = user;
    localStorage.setItem('azura_user', JSON.stringify(user));
  };

  const getUser = () => {
    if (currentUser) return currentUser;
    const session = sessionStorage.getItem('azura_user');
    return session ? JSON.parse(session) : null;
  };

  return {
    init,
    signup,
    login,
    logout,
    getUser,
    setUser
  };
})();
