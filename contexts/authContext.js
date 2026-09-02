import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react"
import Cookies from "js-cookie"
import { verifyPermissions } from "../lib/verification"

const AuthContext = createContext()

const USER_COOKIE_NAME = "user"

const ROLES = {
  ADMIN: [1, 4],
  MANAGER: [1, 2, 4],
  GUEST: [1, 2, 3, 4],
  SU: [4],
}

const isValidStoredUser = (storedUser) => {
  if (
    !storedUser ||
    typeof storedUser !== "object"
  ) {
    return false
  }

  if (
    typeof storedUser.username !==
      "string" ||
    storedUser.username.trim() === ""
  ) {
    return false
  }

  if (
    !storedUser.session ||
    typeof storedUser.session !==
      "object" ||
    typeof storedUser.session.token !==
      "string" ||
    storedUser.session.token.trim() === ""
  ) {
    return false
  }

  const expiration = Number(
    storedUser.session.expires
  )

  return (
    Number.isFinite(expiration) &&
    expiration > Date.now()
  )
}

export const AuthProvider = ({
  children,
}) => {
  const [logged, setLogged] =
    useState(false)
  const [user, setUser] =
    useState(null)

  const [allowedSU, setAllowedSU] =
    useState(false)
  const [
    allowedAdmin,
    setAllowedAdmin,
  ] = useState(false)
  const [
    allowedManager,
    setAllowedManager,
  ] = useState(false)
  const [
    allowedGuest,
    setAllowedGuest,
  ] = useState(false)

  const resetPermissions = () => {
    setAllowedSU(false)
    setAllowedAdmin(false)
    setAllowedManager(false)
    setAllowedGuest(false)
  }

  const clearLocalSession = () => {
    setUser(null)
    setLogged(false)
    resetPermissions()

    Cookies.remove(USER_COOKIE_NAME, {
      path: "/",
    })
  }

  /*
   * Load and validate the locally stored
   * session when the application starts.
   */
  useEffect(() => {
    const cookie = Cookies.get(
      USER_COOKIE_NAME
    )

    if (!cookie) {
      return
    }

    try {
      const storedUser =
        JSON.parse(cookie)

      if (!isValidStoredUser(storedUser)) {
        clearLocalSession()
        return
      }

      setUser(storedUser)
      setLogged(true)
    } catch (error) {
      clearLocalSession()
    }
  }, [])

  /*
   * Recalculate permissions whenever
   * the authenticated user changes.
   */
  useEffect(() => {
    let active = true

    if (!user) {
      resetPermissions()

      return () => {
        active = false
      }
    }

    Promise.all([
      verifyPermissions(ROLES.SU, user),
      verifyPermissions(
        ROLES.ADMIN,
        user
      ),
      verifyPermissions(
        ROLES.MANAGER,
        user
      ),
      verifyPermissions(
        ROLES.GUEST,
        user
      ),
    ])
      .then(
        ([
          canUseSU,
          canUseAdmin,
          canUseManager,
          canUseGuest,
        ]) => {
          if (!active) {
            return
          }

          setAllowedSU(canUseSU)
          setAllowedAdmin(canUseAdmin)
          setAllowedManager(
            canUseManager
          )
          setAllowedGuest(canUseGuest)
        }
      )
      .catch(() => {
        if (active) {
          resetPermissions()
        }
      })

    return () => {
      active = false
    }
  }, [user])

  const authorization = () => {
    return user && user.session
      ? Buffer.from(
          `${user.username}:${user.session.token}`
        ).toString("base64")
      : null
  }

  const login = async ({
    username,
    password,
  }) => {
    const request = {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        username,
        password,
      }),
    }

    try {
      const response = await fetch(
        "/api/auth/login",
        request
      )

      const data = await response.json()

      if (
        !response.ok ||
        !data.logged ||
        !isValidStoredUser(data.user)
      ) {
        clearLocalSession()

        alert(
          data.message ||
            "Login was unsuccessful."
        )

        return false
      }

      setLogged(true)
      setUser(data.user)

      Cookies.set(
        USER_COOKIE_NAME,
        JSON.stringify(data.user),
        {
          /*
           * js-cookie accepts a Date here.
           * This makes the browser cookie
           * expire with the server session.
           */
          expires: new Date(
            data.user.session.expires
          ),
          path: "/",
          sameSite: "strict",
          secure:
            process.env.NODE_ENV ===
            "production",
        }
      )

      alert(data.message)

      return true
    } catch (error) {
      console.error(
        "Login request failed."
      )

      alert(
        "Login is temporarily unavailable."
      )

      return false
    }
  }

  const logout = async () => {
    /*
     * Capture the authorization value before
     * removing the local session.
     */
    const currentAuthorization =
      authorization()

    try {
      if (currentAuthorization) {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            Authorization:
              currentAuthorization,
          },
        })
      }
    } catch (error) {
      console.error(
        "Logout request failed."
      )
    } finally {
      /*
       * Always clear browser state, even if
       * the server is temporarily unavailable.
       */
      clearLocalSession()
    }
  }

  const permission = verifyPermissions

  const resetPassword = async (
    newPassword
  ) => {
    const request = {
      method: "PUT",
      headers: {
        "Content-Type":
          "application/json",
        Authorization: authorization(),
      },
      body: JSON.stringify({
        password: newPassword,
      }),
    }

    try {
      const response = await fetch(
        "/api/auth/password",
        request
      )

      const data = await response.json()

      alert(data.message)
    } catch (error) {
      console.error(
        "Password update request failed."
      )

      alert(
        "Password update is temporarily unavailable."
      )
    }
  }

  const upsertUser = async ({
    username,
    password,
    permission,
    name,
    country,
  }) => {
    const request = {
      method: "PUT",
      headers: {
        "Content-Type":
          "application/json",
        Authorization: authorization(),
      },
      body: JSON.stringify({
        username,
        password,
        permission,
        name,
        country,
      }),
    }

    try {
      const response = await fetch(
        "/api/auth/user",
        request
      )

      const data = await response.json()

      alert(data.message)
    } catch (error) {
      console.error(
        "User update request failed."
      )

      alert(
        "User update is temporarily unavailable."
      )
    }
  }

  const deleteUser = async ({
    username,
    permission,
    remove,
  }) => {
    const request = {
      method: "DELETE",
      headers: {
        "Content-Type":
          "application/json",
        Authorization: authorization(),
      },
      body: JSON.stringify({
        username,
        permission,
        remove,
      }),
    }

    try {
      const response = await fetch(
        "/api/auth/user",
        request
      )

      const data = await response.json()

      alert(data.message)
    } catch (error) {
      console.error(
        "User deletion request failed."
      )

      alert(
        "User deletion is temporarily unavailable."
      )
    }
  }

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
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
