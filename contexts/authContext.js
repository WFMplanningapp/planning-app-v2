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

  useEffect(() => {
    let cookie = Cookies.get('user');
    if (cookie) {
      setUser(JSON.parse(cookie));
      setLogged(true);
      console.log('LOGGED IN FROM COOKIE');
    } else {
      console.log('NO COOKIE');
    }
  }, []);

  useEffect(() => {
    verifyPermissions(ROLES.SU, user).then((result) => {
      setAllowedSU(result);
      // console.log(result)
    });
  });
  useEffect(() => {
    verifyPermissions(ROLES.ADMIN, user).then((result) => {
      setAllowedAdmin(result);
      // console.log(result)
    });
  });
  useEffect(() => {
    verifyPermissions(ROLES.MANAGER, user).then((result) => {
      setAllowedManager(result);
      // console.log(result)
    });
  });
  useEffect(() => {
    verifyPermissions(ROLES.GUEST, user).then((result) => {
      setAllowedGuest(result);
      // console.log(result)
    });
  });

  const login = async ({ username, password }) => {
    const request = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password: password, username: username }),
    };

    // console.log(request)

    fetch('/api/auth/login', request)
      .then((response) => response.json())
      .then((data) => {
        setLogged(data.logged);
        console.log('DATA USER', data.user);
        setUser(data.user);
        alert(data.message);
        data.user &&
          Cookies.set('user', JSON.stringify(data.user), {
            expires: Math.round(
              data.user.session.expires - new Date().getTime() / 3600000
            ),
          });
        // console.log(data.message);
      })
      .catch((err) => console.log('Something went wrong!'));
  };

  const logout = () => {
    setUser(null);
    setLogged(false);
    Cookies.remove('user');
  };
  const ROLES = {
    ADMIN: [1, 4],
    MANAGER: [1, 2, 4],
    GUEST: [1, 2, 3, 4],
    SU: [4],
  };

  const permission = verifyPermissions;

  const authorization = () => {
    return user && user.session
      ? Buffer.from(user.username + ':' + user.session.token).toString('base64')
      : null;
  };

  const resetPassword = (newPassword) => {
    const request = {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization(),
      },
      body: JSON.stringify({ password: newPassword }),
    };

    console.log(request);

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

    console.log(request);

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

    console.log(request);

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
