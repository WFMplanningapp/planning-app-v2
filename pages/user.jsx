import Head from "next/head"
import {
  useCallback,
  useEffect,
  useState,
} from "react"
import { useAuth } from "../contexts/authContext"
import useForm from "../hooks/useForm"
import StructureDropdown from "../components/selection/StructureDropdownUN"

import {
  FaUser,
  FaLock,
  FaIdBadge,
  FaGlobeAmericas,
  FaClock,
} from "react-icons/fa"

const selectionFields = [
  {
    name: "username",
    default: null,
    required: true,
    type: "object",
    level: 1,
  },
]

export default function UserAdministration() {
  const [agreement, setAgreement] =
    useState(true)
  const [buttonMessage, setButtonMessage] =
    useState("Create User")
  const [deleteButton, setDeleteButton] =
    useState(false)
  const [users, setUsers] = useState([])
  const [userLoadError, setUserLoadError] =
    useState(null)

  const auth = useAuth()
  const authorization = auth.authorization()

  const form = useForm({
    fields: [
      {
        name: "username",
        default: "",
        required: true,
        type: "text",
      },
      {
        name: "name",
        default: "",
        required: true,
        type: "text",
      },
      {
        name: "country",
        default: "",
        required: false,
        type: "text",
      },
      {
        name: "password",
        default: "",
        required: agreement,
        type: "password",
      },
      {
        name: "permission",
        default: "",
        required: true,
        type: "number",
      },
    ],
  })

  const selection = useForm({
    fields: selectionFields,
  })

  const refreshUsers = useCallback(async () => {
    if (!auth.allowedSU || !authorization) {
      setUsers([])
      return
    }

    try {
      setUserLoadError(null)

      const response = await fetch(
        "/api/auth/user",
        {
          method: "GET",
          headers: {
            Authorization: authorization,
          },
        }
      )

      const result = await response.json()

      if (!response.ok) {
        setUsers([])
        setUserLoadError(
          result.message ||
            "Unable to retrieve users."
        )
        return
      }

      setUsers(
        Array.isArray(result.data)
          ? result.data
          : []
      )
    } catch (error) {
      console.error(
        "User retrieval failed:",
        error
      )

      setUsers([])
      setUserLoadError(
        "Unable to retrieve users."
      )
    }
  }, [auth.allowedSU, authorization])

  useEffect(() => {
    refreshUsers()
  }, [refreshUsers])

  const handleChange = (event) => {
    setAgreement(event.target.checked)
  }

  const handleUpsertUser = () => {
    auth.upsertUser({
      username: form.get("username"),
      password: form.get("password"),
      name: form.get("name"),
      country: form.get("country"),
      permission: form.get("permission"),
    })

    form.resetAll()
  }

  const handleDeleteUser = () => {
    if (
      window.confirm(
        "Are you sure you want to delete this user?"
      )
    ) {
      auth.deleteUser({
        username: form.get("username"),
        permission: form.get("permission"),
        remove: true,
      })

      form.resetAll()
    }
  }

  const loggedUsers = users
    .filter((user) => {
      const expiration = Number(
        user.session?.expires
      )

      return (
        Number.isFinite(expiration) &&
        expiration > Date.now()
      )
    })
    .map((user) => {
      const expiration = Number(
        user.session.expires
      )

      const sessionStart =
        expiration - 43200000

      const elapsedMilliseconds =
        Math.max(
          0,
          Date.now() - sessionStart
        )

      const minutes = Math.floor(
        elapsedMilliseconds / (1000 * 60)
      )

      const hours =
        elapsedMilliseconds /
        (1000 * 60 * 60)

      return {
        name: user.username,
        loggedHours:
          minutes < 60
            ? `${minutes} min`
            : `${hours.toFixed(1)} h`,
        color: hours > 6 ? "red" : "black",
      }
    })

  return (
    <>
      <Head>
        <title>
          Planning App | User Admin
        </title>
      </Head>

      <div className="mt-auto mb-auto">
        {!auth.allowedSU ? (
          <div className="message is-danger is-size-5 px-5 py-5">
            <span>
              <FaLock />
            </span>{" "}
            UNAUTHORIZED ACCESS
          </div>
        ) : (
          <div className="columns">
            <div className="column is-two-fifths has-text-centered ml-auto mr-5 px-6 pb-5 pt-4 card">
              <h1 className="is-size-5">
                USER ADMIN
              </h1>

              <br />

              {userLoadError && (
                <div className="message is-danger p-3">
                  {userLoadError}
                </div>
              )}

              <div className="column field">
                <label className="label">
                  Selection
                </label>

                <StructureDropdown
                  structureName="username"
                  form={form}
                  selection={selection}
                  data={users}
                  disabled={false}
                  callback={(currentForm, selectedUser) => {
                    currentForm.setMany({
                      username:
                        selectedUser.username,
                      name: selectedUser.name,
                      country:
                        selectedUser.country,
                      permission:
                        selectedUser.permission,
                    })

                    setAgreement(false)
                    setButtonMessage(
                      "Update User"
                    )
                    setDeleteButton(true)
                  }}
                />
              </div>

              <label htmlFor="agreement">
                Password required?
              </label>

              <input
                type="checkbox"
                name="agreement"
                onChange={handleChange}
                id="agreement"
                checked={agreement}
                style={{ marginLeft: "5px" }}
              />

              <div className="field">
                <label className="label">
                  <FaUser /> Username
                </label>

                <div className="control">
                  <input
                    className="input"
                    onChange={(event) =>
                      form.set(
                        "username",
                        event.target.value
                      )
                    }
                    value={
                      form.get("username") || ""
                    }
                    type="text"
                    placeholder="Username"
                  />
                </div>
              </div>

              <div
                className="field"
                style={{
                  display: "inline-block",
                  marginRight: "5px",
                  width: "49%",
                }}
              >
                <label className="label">
                  <FaUser /> Name
                </label>

                <div className="control">
                  <input
                    className="input"
                    onChange={(event) =>
                      form.set(
                        "name",
                        event.target.value
                      )
                    }
                    value={
                      form.get("name") || ""
                    }
                    type="text"
                    placeholder="Name"
                  />
                </div>
              </div>

              <div
                className="field"
                style={{
                  display: "inline-block",
                  marginLeft: "5px",
                  width: "48%",
                }}
              >
                <label className="label">
                  <FaGlobeAmericas /> Country
                </label>

                <div className="control">
                  <input
                    className="input"
                    onChange={(event) =>
                      form.set(
                        "country",
                        event.target.value
                      )
                    }
                    value={
                      form.get("country") || ""
                    }
                    type="text"
                    placeholder="Country"
                  />
                </div>
              </div>

              <div className="field">
                <label className="label">
                  <FaLock /> Password
                </label>

                <div className="control">
                  <input
                    className="input"
                    onChange={(event) =>
                      form.set(
                        "password",
                        event.target.value
                      )
                    }
                    value={
                      form.get("password") || ""
                    }
                    type="password"
                    placeholder="Password"
                  />
                </div>
              </div>

              <div className="field">
                <label className="label">
                  <FaIdBadge /> Permission
                </label>

                <div className="control">
                  <input
                    className="input"
                    onChange={(event) =>
                      form.set(
                        "permission",
                        Number.parseInt(
                          event.target.value,
                          10
                        )
                      )
                    }
                    value={
                      form.get("permission") || ""
                    }
                    type="number"
                    min="1"
                    max="4"
                    placeholder="[1-4]"
                  />
                </div>
              </div>

              <br />

              <button
                className={
                  auth.allowedSU
                    ? "button is-primary"
                    : "button is-danger"
                }
                onClick={handleUpsertUser}
                type="button"
                disabled={
                  !auth.allowedSU ||
                  !form.checkRequired()
                }
              >
                {auth.allowedSU ? (
                  buttonMessage
                ) : (
                  <>
                    Unauthorized <FaLock />
                  </>
                )}
              </button>

              <button
                className={
                  auth.allowedSU
                    ? "button is-danger ml-5"
                    : "button is-disabled ml-5"
                }
                onClick={handleDeleteUser}
                type="button"
                disabled={
                  !auth.allowedSU ||
                  !deleteButton
                }
              >
                {auth.allowedSU ? (
                  "Delete User"
                ) : (
                  <>
                    Unauthorized <FaLock />
                  </>
                )}
              </button>
            </div>

            <div className="flex-column is-two-fifths ml-5 mr-auto px-6 pb-5 pt-4 card">
              <h1 className="is-size-5">
                LOGGED USERS
              </h1>

              <div
                className="field mt-5"
                style={{
                  display: "inline-block",
                  fontWeight: 400,
                }}
              >
                <label className="label">
                  <FaUser /> User
                </label>

                {loggedUsers.map((user) => (
                  <p
                    key={`user-${user.name}`}
                    style={{
                      color: user.color,
                    }}
                  >
                    {user.name}
                  </p>
                ))}
              </div>

              <div
                className="field has-text-centered mt-5"
                style={{
                  display: "inline-block",
                }}
              >
                <label className="label">
                  <FaClock /> Logged Hours
                </label>

                {loggedUsers.map((user) => (
                  <p
                    key={`hours-${user.name}`}
                    style={{
                      color: user.color,
                    }}
                  >
                    {user.loggedHours}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
