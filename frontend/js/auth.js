/**
 * KEENEED 用户认证模块
 */
const AUTH_API = /api/auth;
const AUTH_STORAGE_KEY = keeneed_user;
const TOKEN_KEY = keeneed_token;

// ===== 工具函数 =====
function getStoredUser() {
  const data = localStorage.getItem(AUTH_STORAGE_KEY);
  return data ? JSON.parse(data) : null;
}

function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setAuthSession(user, token) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  localStorage.setItem(TOKEN_KEY, token);
}

function clearAuthSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

// ===== 带认证的请求 =====
async function authFetch(url, options = {}) {
  const token = getStoredToken();
  const headers = {
    Content-Type: application/json,
    ...options.headers
  };
  if (token) {
    headers[Authorization] = `Bearer ${token}`;
  }
  const res = await fetch(url, {
    ...options,
    headers
  });
  if (res.status === 401) {
    clearAuthSession();
    if (!window.location.pathname.includes(login)) {
      window.location.href = /login.html;
    }
  }
  return res;
}

// ===== 注册 =====
async function register(username, password, email, bio) {
  try {
    const res = await fetch(AUTH_API + /register, {
      method: POST,
      headers: { Content-Type: application/json },
      body: JSON.stringify({ username, password, email, bio })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      const { user_id, keeneed_id, username, identity_type, token } = data.data;
      setAuthSession({ id: user_id, keeneed_id, username, identity_type }, token);
      return { success: true, user: data.data };
    }
    return { success: false, error: data.error || 注册失败 };
  } catch (e) {
    return { success: false, error: 网络错误 };
  }
}

// ===== 登录 =====
async function login(username, password) {
  try {
    const res = await fetch(AUTH_API + /login, {
      method: POST,
      headers: { Content-Type: application/json },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      const { user_id, keeneed_id, username, identity_type, bio, token } = data.data;
      setAuthSession({ id: user_id, keeneed_id, username, identity_type, bio }, token);
      return { success: true, user: data.data };
    }
    return { success: false, error: data.error || 登录失败 };
  } catch (e) {
    return { success: false, error: 网络错误 };
  }
}

// ===== 获取当前用户信息 =====
async function getCurrentUser() {
  try {
    const res = await authFetch(AUTH_API + /me);
    const data = await res.json();
    if (res.ok && data.success) {
      const user = data.data;
      setAuthSession({
        id: user.id,
        keeneed_id: user.keeneed_id,
        username: user.username,
        identity_type: user.identity_type,
        bio: user.bio
      }, getStoredToken());
      return { success: true, user };
    }
    return { success: false, error: data.error };
  } catch (e) {
    return { success: false, error: 网络错误 };
  }
}

// ===== 登出 =====
function logout() {
  clearAuthSession();
  window.location.href = /login.html;
}

// ===== 检查登录状态（用于需要登录的页面） =====
function requireLogin(redirectUrl = /login.html) {
  if (!getStoredToken() || !getStoredUser()) {
    window.location.href = redirectUrl;
    return false;
  }
  return true;
}

// ===== 检查已登录用户跳转到目标页 =====
function redirectIfLoggedIn(targetUrl = /agent-chat.html) {
  if (getStoredToken() && getStoredUser()) {
    window.location.href = targetUrl;
    return true;
  }
  return false;
}

if (typeof module !== undefined) {
  module.exports = { register, login, logout, getCurrentUser, requireLogin, authFetch };
}
