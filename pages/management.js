import Head from "next/head"
import { useState } from "react"
import LobManagement from "../components/management/LobManagement"
import ProjectManagement from "../components/management/ProjectManagement"
import CapPlanManagement from "../components/management/CapPlanManagement"
import { useAuth } from "../contexts/authContext"
import useData from "../hooks/useData"
import { FaLock } from "react-icons/fa"
import StaffingManagement from "../components/management/StaffingManagement"
import EntriesManagement from "../components/management/EntriesManagement"
import moment from "moment"

export default function Management() {
	const [screen, setScreen] = useState("projects")

	const data = useData(["countries", "projects", "lobs", "capPlans", "languages", "fields", "dow", "hours","pms"])

	const auth = useAuth()

	return (
		<>
			<Head>
				<title>Planning App | Management</title>
			</Head>
			<div>
				<h1 className="has-text-centered mb-2 is-size-5">MANAGEMENT</h1>
				<div className="columns">
					<div className="column is-narrow" style={{ minWidth: "200px" }}>
						<div className="panel">
							<h2 className="panel-heading is-size-6">
								{screen.toUpperCase()}
							</h2>
							<a
								className=" panel-block "
								onClick={() => {
									setScreen("projects")
								}}
							>
								Projects
							</a>
							<a className=" panel-block " onClick={() => setScreen("lobs")}>
								Lobs
							</a>
							<a
								className=" panel-block "
								onClick={() => setScreen("capPlans")}
							>
								Cap Plans
							</a>
							<a className=" panel-block " onClick={() => setScreen("entries")}>
								Entries
							</a>
							<a
								className=" panel-block "
								onClick={() => setScreen("staffing")}
							>
								Staffing
							</a>
						</div>
					</div>
					<div className="column">
						{!auth.allowedAdmin ? (
							<div className="message is-danger is-size-5 px-5 py-5">
								<span className="">
									<FaLock />
								</span>{" "}
								UNAUTHORIZED ACCESS
							</div>
						) : screen === "projects" ? (
							<ProjectManagement data={data} />
						) : screen === "lobs" ? (
							<LobManagement data={data} />
						) : screen === "capPlans" ? (
							<CapPlanManagement data={data} />
						) : screen === "entries" ? (
							<EntriesManagement data={data} />
						) : (
							<StaffingManagement data={data} />
						)}
					</div>
				</div>
			</div>
		</>
	)
}
