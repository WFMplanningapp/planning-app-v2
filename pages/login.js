import Head from "next/head"
import { useAuth } from "../contexts/authContext"
import useForm from "../hooks/useForm"
import { useState, useEffect } from "react"
import { FaUser, FaLock } from "react-icons/fa"

const formFields = [
  { name: "username", default: "", required: true, type: "text" },
  { name: "password", default: "", required: true, type: "password" },
]

export default function Login() {
  const form = useForm({
    fields: formFields,
  })

  const auth = useAuth()

  const handleLogin = () => {
    auth.login({
      username: form.get("username"),
      password: form.get("password"),
    })

    form.resetAll()
  }
  const [accessLevel, setAccessLevel] = useState("No Permissions set yet!")

  useEffect(() => {
    if (auth.user && auth.user.permission === 4){
      setAccessLevel("Super User");
    }else if(auth.user && auth.user.permission === 3){
      setAccessLevel("Viewer")
    }else if(auth.user && auth.user.permission === 2){
      setAccessLevel("Manager")
    }else if(auth.user && auth.user.permission === 1){
      setAccessLevel("Admin")
    }
  })

  const handleLogout = () => {
    auth.logout()
    form.resetAll()
  }

  const handleResetPassword = () => {
    auth.resetPassword(form.get("password"))
    form.resetAll()
  }

  return (
    <>
      <Head>
        <title>Planning App | Login</title>
      </Head>
      <div className="mt-auto mb-auto">
        <div className="columns">
          <div className="column is-two-fifths has-text-centered mx-auto px-6 pb-5 pt-4 card">
            <h1 className="is-size-5">AUTHENTICATION</h1>
            <br />

            {!auth.logged || !auth.user ? (
              <>
                <div className="field">
                  <label className="label">
                    <FaUser /> Username
                  </label>
                  <div className="control">
                    <input
                      className="input"
                      onChange={(e) => form.set("username", e.target.value)}
                      value={form.get("username") || ""}
                      type="text"
                      placeholder="Username"
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
                      onChange={(e) => form.set("password", e.target.value)}
                      value={form.get("password") || ""}
                      type="password"
                      placeholder="Password"
                      onKeyDown={(e) => {
                        const { key, keyCode} = e;
                        if (keyCode === 13){
                          handleLogin()
                        }
                      } 
                      }
                    />
                  </div>
                </div>
                <br />
                <button
                  className="button is-primary"
                  onClick={handleLogin}
                  
                  type="button"
                >
                  LOG IN
                </button>
              </>
            ) : (
              <>
                <h3>You are Logged In</h3>
                <p>
                  {" "}
                  <FaUser /> User: {auth.user.username}
                </p>
                <p>Permission: {accessLevel}</p>

                <br></br>

                <div className="field">
                  <label className="label">
                    <FaLock /> New Password
                  </label>
                  <div className="control">
                    <input
                      className="input"
                      onChange={(e) => form.set("password", e.target.value)}
                      value={form.get("password") || ""}
                      type="password"
                      placeholder="Password"
                    />
                  </div>
                </div>

                <br></br>

                <button
                  className="button mr-3 is-primary"
                  onClick={handleResetPassword}
                  type="button"
                >
                  RESET PASSWORD
                </button>

                <button
                  className="button is-danger"
                  onClick={handleLogout}
                  type="button"
                >
                  LOG OUT
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
