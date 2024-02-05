import Link from "next/link"

import { useState } from "react"

import { useAuth } from "../contexts/authContext"

import { FaUserCog } from "react-icons/fa"

const Header = () => {
  const [isActive, setisActive] = useState(false)
  const auth = useAuth()

  return (
    <header>
      <nav
        className="navbar container"
        role="navigation"
        aria-label="main navigation"
      >
        <div className="navbar-brand ">
          <Link href="/">
            <a className="navbar-item px-2" href="/">
              Planning App
            </a>
          </Link>
          {auth.allowedSU ? 
                    <Link href="/user">
                    <a className="navbar-item px-2" href="/">
                      User Admin <FaUserCog />
                    </a>
                  </Link> : <></>}
          <a
            role="button"
            onClick={() => setisActive(!isActive)}
            className={`navbar-burger burger ${isActive ? "is-active" : ""}`}
            aria-label="menu"
            aria-expanded="false"
            data-target="navbarBasicExample"
          >
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
          </a>
        </div>

        <div
          id="navbarBasicExample"
          className={`navbar-menu ${isActive ? "is-active" : ""}`}
        >
          <div className="navbar-end">
            <Link href="/login">
              <a className="navbar-item ml-3 has-text-primary">
                {auth.user && auth.logged ? auth.user.username : "Login"}
              </a>
            </Link>
            <Link href="/management">
              <a className="navbar-item">Management</a>
            </Link>

            <div className="navbar-item has-dropdown is-hoverable">
              <a className="navbar-link">Tools</a>
              <div className="navbar-dropdown">
                <Link href="/capacity">
                  <a className="navbar-item">Capacity</a>
                </Link>
                <Link href="/staffing">
                  <a className="navbar-item">Staffing</a>
                </Link>
                <Link href="/report">
                  <a className="navbar-item">Report</a>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>
  )
}

export default Header
