import Link from 'next/link';

import { useState } from 'react';

import { useAuth } from '../contexts/authContext';

import { FaUserCog } from 'react-icons/fa';

const Header = () => {
  const [isActive, setisActive] = useState(false);
  const auth = useAuth();

  return (
    <header>
      <nav
        className="navbar container"
        role="navigation"
        aria-label="main navigation"
      >
        <div className="navbar-brand ">
          <Link href="/" className="navbar-item px-2">
            Planning App
          </Link>
          {auth.allowedSU ? (
            <Link href="/user" className="navbar-item user px-2">
              User Admin <FaUserCog />
            </Link>
          ) : (
            <></>
          )}
          <a
            role="button"
            onClick={() => setisActive(!isActive)}
            className={`navbar-burger burger ${isActive ? 'is-active' : ''}`}
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
          className={`navbar-menu ${isActive ? 'is-active' : ''}`}
        >
          <div className="navbar-end">
            <Link href="/login" className="navbar-item ml-3 has-text-primary">
              {auth.user && auth.logged ? auth.user.username : 'Login'}
            </Link>
            <Link href="/management" className="navbar-item">
              Management
            </Link>

            <div className="navbar-item has-dropdown is-hoverable">
              <a className="navbar-link">Tools</a>
              <div className="navbar-dropdown">
                <Link href="/capacity" className="navbar-item">
                  Capacity
                </Link>
                <Link href="/staffing" className="navbar-item">
                  Staffing
                </Link>
                <Link href="/report" className="navbar-item">
                  Report
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Header;
