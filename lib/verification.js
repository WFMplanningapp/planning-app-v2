export const ROLES = {
  ADMIN: [1, 4],
  MANAGER: [1, 2, 4],
  GUEST: [1, 2, 3, 4],
  SU: [4],
};
export const verifyPermissions = async (
  p,
  user = null,
  db = null,
  authorization = null
) => {
  //  console.log(p,user);
  if (user && Object.keys(user).length > 0) {
    //console.log('user Exists and has keys');
    const permissions = Object.values(ROLES).filter((oRole) => {
      return oRole.indexOf(user.permission) >= 0;
    });
    return (
      permissions.filter((perm) => {
        return perm.toString() === p.toString();
      }).length > 0
    );
  } else if (authorization && db) {
    //console.log('user no exists, but authorization and db do');
    const [username] = Buffer.from(authorization, 'base64')
      .toString()
      .split(':');

    let user = null;

    if (username) {
      try {
        await db.collection('verification').findOne({ username: username });
      } catch (err) {
        console.log(err);
      }
    }

    //console.log('user:', user);
    if (!user) return false;
    const permissions = Object.values(ROLES).filter((oRole) => {
      return oRole.indexOf(user.permission) >= 0;
    });
    return (
      permissions.filter((perm) => {
        return perm === p;
      }).length > 0
    );
  } else {
    return false;
  }
};

export const verifySession = async (db, authorization) => {
  let [username, token] = Buffer.from(authorization, 'base64')
    .toString()
    .split(':');

  let user = username
    ? await db.collection('verification').findOne({ username: username })
    : null;

  //console.log(user);

  if (user && user.session) {
    if (user.session.token !== token) {
      console.log('Invalid Token!');
      return {
        message: 'Invalid Token!',
        verified: false,
        user,
      };
    } else if (user.session.expired < new Date().getTime()) {
      console.log('Session Expired!');
      return {
        message: 'Session Expired!',
        verified: false,
        user,
      };
    } else {
      console.log('User Verified!');
      return {
        message: 'User Verified!',
        verified: true,
        permission: user.permission,
        user,
      };
    }
  } else {
    console.log('No user or session!');
    return {
      message: 'No user or session!',
      verified: false,
    };
  }
};
