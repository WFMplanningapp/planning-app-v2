import Head from "next/head"
import { useState } from "react"
import { useAuth } from "../contexts/authContext"
import useForm from "../hooks/useForm"
import StructureDropdown from "../components/selection/StructureDropdownUN"
import useData from "../hooks/useData"

import { FaUser, FaLock, FaIdBadge, FaGlobeAmericas, FaClock } from "react-icons/fa"
import { each } from "lodash"

const selectionFields = [
    { name: "user", default: null, required: true, type: "object", level: 1 },
]





export default function Login() {
    const [agreement, setAgreement] = useState(true);
    const [inputDis, setInputThis] = useState(false);
    const [bttnMessage, setBttnMsg] = useState("Create User");
    const [deleteBtn, setDeleteBtn] = useState(false);
    const handleInputChange = (event) => {
        setInputThis(event.target.disabled);
    }
    const handleChange = (event) => {
        setAgreement(event.target.checked);
    }



    const form = useForm({
        fields: [
            { name: "username", default: "", required: true, type: "text" },
            { name: "name", default: "", required: true, type: "text" },
            { name: "country", default: "", required: false, type: "text"},
            { name: "password", default: "", required: agreement, type: "password" },
            { name: "permission", default: "", required: true, type: "number" },
        ],
    })


    const data = useData([
        "verification",
    ])

    const selection = useForm({
        fields: selectionFields,
    })

    const auth = useAuth()

  const loggedUsr = [];
  if (data && data.verification) {
    data.verification.forEach(user => {
      if (user.session.expires > 0 && user.session.expires > Date.now()) {
        console.log(new Date(user.session.expires - 43000000));
        const diff = Date.now() - (new Date(user.session.expires - 43000000).getTime());
        const minetes = (diff / (1000 * 60)).toFixed(0);
        const hours = (diff / (1000 * 60 * 60)).toFixed(1);
        console.log((diff / (1000 * 60 * 60)).toFixed(1));
        loggedUsr.push({
          name: user.username,
          loggedHrs: minetes < 60 ? `${minetes} min` : `${hours} h`,
          color: hours > 6 ? "red" : "black",
        })
      }
    })
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
    if (window.confirm("Are you sure you want to Delete?")) {
      console.log("Burp")
      auth.deleteUser({
        username: form.get("username"),
        permission: form.get("permission"),
        remove: true,
      })

      form.resetAll()

    }

  }

  const listItemUsr = loggedUsr.map(user => <p style={{ color: `${user.color}` }}>{user.name}</p> )
  const listItemHrs = loggedUsr.map(user => <p style={{ color: `${user.color}` }}>{user.loggedHrs}</p> )

    return (
        <>
            <Head>
                <title>Planning App | User Admin</title>
            </Head>
        <div className="mt-auto mb-auto">
          {!auth.permission(3) ? (
            <div className="message is-danger is-size-5 px-5 py-5">
              <span className="">
                <FaLock />
              </span>{" "}
              UNAUTHORIZED ACCESS
            </div>
          ) :
            <div className="columns">
              <div className="column is-two-fifths has-text-centered ml-auto mr-5 px-6 pb-5 pt-4 card">
                <h1 className="is-size-5">USER ADMIN</h1>
                <br />
                <>
                  <div className="column field">
                    <label className="label">Selection</label>
                    <StructureDropdown
                      structureName="username"
                      form={form}
                      selection={selection}
                      data={
                        data &&
                        data.verification
                      }
                      disabled={false}
                      callback={(f, s) => {
                        f.setMany({
                          username: s.username,
                          name: s.name,
                          country: s.country,
                          permission: s.permission,


                        })
                        setAgreement(false);
                        setInputThis(true);
                        setBttnMsg("Update User");
                        setDeleteBtn(true);
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
                        onChange={(e) => form.set("username", e.target.value)}
                        value={form.get("username") || ""}
                        type="text"
                        placeholder="Username"
                      />
                    </div>
                  </div>
                  <div className="field" style={{ display: "inline-block", marginRight: 5 + "px", width: 49 + "%" }} >
                    <label className="label">
                      <FaUser /> Name
                    </label>
                    <div className="control">
                      <input
                        className="input"
                        onChange={(e) => form.set("name", e.target.value)}
                        value={form.get("name") || ""}
                        type="text"
                        placeholder="Name"
                      />
                    </div>
                  </div>
                  <div className="field" style={{ display: "inline-block", marginLeft: 5 + "px", width: 48 + "%" }}>
                    <label className="label">
                      <FaGlobeAmericas /> Country
                    </label>
                    <div className="control">
                      <input
                        className="input"
                        onChange={(e) => form.set("country", e.target.value)}
                        value={form.get("country") || ""}
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
                        onChange={(e) => form.set("password", e.target.value)}
                        value={form.get("password") || ""}
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
                        onChange={(e) =>
                          form.set("permission", parseInt(e.target.value))
                        }
                        value={form.get("permission") || ""}
                        type="number"
                        placeholder="[1-3]"
                      />
                    </div>
                  </div>
                  <br />
                  <button
                    className={
                      auth.permission(1) ? "button is-primary" : "button is-danger"
                    }
                    onClick={handleUpsertUser}
                    type="button"
                    disabled={!auth.permission(1) || !form.checkRequired()}
                  >
                    {auth.permission(1) ? (
                      <>{bttnMessage} </>
                    ) : (
                      <>
                        Unauthorized <FaLock />
                      </>
                    )}
                  </button>
                  <button
                    className={
                      auth.permission(1) ? "button is-danger ml-5" : "button is-disabled ml-5"
                    }
                    onClick={handleDeleteUser}
                    type="button"
                    disabled={!auth.permission(1) || !deleteBtn}
                  >
                    {auth.permission(1) ? (
                      <>Delete User </>
                    ) : (
                      <>
                        Unauthorized <FaLock />
                      </>
                    )}
                  </button>
                </>

              </div>
              <div className="flex-column is-two-fifths ml-5 mr-auto px-6 pb-5 pt-4 card">
                <h1 className="is-size-5">LOGGED USERS</h1>
                <div className="field mt-5" style={{ display: "inline-block", fontWeight: 400 }} >
                  <label className="label">
                    <FaUser /> User
                  </label>
                  {listItemUsr}
                </div>
                <div className="field has-text-centered mt-5" style={{ display: "inline-block" }}>
                  <label className="label">
                    <FaClock /> Logged Hours
                  </label>
                  {listItemHrs}
                </div>
              </div>
            </div>
          }
        </div>
        </>
    )
}
