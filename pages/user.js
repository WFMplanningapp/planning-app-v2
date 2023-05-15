import Head from "next/head"
import { useState } from "react"
import { useAuth } from "../contexts/authContext"
import useForm from "../hooks/useForm"
import StructureDropdown from "../components/selection/StructureDropdownUN"
import useData from "../hooks/useData"

import { FaUser, FaLock, FaIdBadge } from "react-icons/fa"

const selectionFields = [
    { name: "user", default: null, required: true, type: "object", level: 1 },
]





export default function Login() {
    const [agreement, setAgreement] = useState(true);
    const [inputDis, setInputThis] = useState(false);
    const [bttnMessage, setBttnMsg] = useState("Create User");

    const handleInputChange = (event) => {
        setInputThis(event.target.disabled);
    }
    const handleChange = (event) => {
        setAgreement(event.target.checked);
    }

    const form = useForm({
        fields: [
            { name: "username", default: "", required: true, type: "text" },
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

    const handleUpsertUser = () => {
        auth.upsertUser({
            username: form.get("username"),
            password: form.get("password"),
            permission: form.get("permission"),
        })

        form.resetAll()

    }



    return (
        <>
            <Head>
                <title>Planning App | User Admin</title>
            </Head>
            <div className="mt-auto mb-auto">
                <div className="columns">
                    <div className="column is-two-fifths has-text-centered mx-auto px-6 pb-5 pt-4 card">
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
                                            permission: s.permission,

                                        })
                                        setAgreement(false);
                                        setInputThis(true);
                                        setBttnMsg("Update User");
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
                                        disabled={inputDis}
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
                        </>
                    </div>
                </div>
            </div>
        </>
    )
}
