import { createContext, useContext, useState, useEffect } from 'react';
import Cookies from 'js-cookie';
import { verifyPermissions } from '../lib/verification';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [logged, setLogged] = useState(false);
  const [user, setUser] = useState({});
  const [allowedSU, setAllowedSU] = useState(false);
  const [allowedAdmin, setAllowedAdmin] = useState(false);
  const [allowedManager, setAllowedManager] = useState(false);
  const [allowedGuest, setAllowedGuest] = useState(false);

  const ROLES = {
    ADMIN: [1, 4],
    MANAGER: [1, 2, 4],
    GUEST: [1, 2, 3, 4],
    SU: [4],
  };

  // Load user from cookie on mount
  useEffect(() => {
    let cookie = Cookies.get('user');
    if (cookie) {
      setUser(JSON.parse(cookie));
      setLogged(true);
    }
  }, []);

  // Verify all permissions in a single hook — only when user changes
  useEffect(() => {
    if (!user) return;

    verifyPermissions(ROLES.SU, user).then(setAllowedSU);
    verifyPermissions(ROLES.ADMIN, user).then(setAllowedAdmin);
    verifyPermissions(ROLES.MANAGER, user).then(setAllowedManager);
    verifyPermissions(ROLES.GUEST, user).then(setAllowedGuest);
  }, [user]);

  const authorization = () => {
    return user && user.session
      ? Buffer.from(user.username + ':' + user.session.token).toString('base64')
      : null;
  };

  const login = async ({ username, password }) => {
    const request = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password: password, username: username }),
    };

    fetch('/api/auth/login', request)
      .then((response) => response.json())
      .then((data) => {
        setLogged(data.logged);
        setUser(data.user);
        alert(data.message);
        data.user &&
          Cookies.set('user', JSON.stringify(data.user), {
            expires: Math.round(
              data.user.session.expires - new Date().getTime() / 3600000
            ),
          });
      })
      .catch((err) => console.log('Something went wrong!'));
  };

  const logout = () => {
    setUser(null);
    setLogged(false);
    Cookies.remove('user');
  };

  const permission = verifyPermissions;

  const resetPassword = (newPassword) => {
    const request = {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization(),
      },
      body: JSON.stringify({ password: newPassword }),
    };

    fetch('/api/auth/password', request)
      .then((response) => response.json())
      .then((data) => {
        alert(data.message);
      })
      .catch((err) => console.log('Something went wrong!'));
  };

  const upsertUser = ({ username, password, permission, name, country }) => {
    const request = {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization(),
      },
      body: JSON.stringify({ username, password, permission, name, country }),
    };

    fetch('/api/auth/user', request)
      .then((response) => response.json())
      .then((data) => {
        alert(data.message);
      })
      .catch((err) => console.log('Something went wrong!'));
  };

  const deleteUser = ({ username, permission, remove }) => {
    const request = {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization(),
      },
      body: JSON.stringify({ username, permission, remove }),
    };

    fetch('/api/auth/user', request)
      .then((response) => response.json())
      .then((data) => {
        alert(data.message);
      })
      .catch((err) => console.log('Something went wrong!'));
  };

  return (
    <AuthContext.Provider
      value={{
        logged,
        user,
        allowedSU,
        allowedAdmin,
        allowedManager,
        allowedGuest,
        login,
        logout,
        ROLES,
        permission,
        authorization,
        resetPassword,
        upsertUser,
        deleteUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  return useContext(AuthContext);
}