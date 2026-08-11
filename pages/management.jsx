import Head from "next/head";
import { useState } from "react";
import { FaLock } from "react-icons/fa";

import { useAuth } from "../contexts/authContext";
import useData from "../hooks/useData";

import LobManagement from "../components/management/LobManagement";
import ProjectManagement from "../components/management/ProjectManagement";
import CapPlanManagement from "../components/management/CapPlanManagement";
import StaffingManagement from "../components/management/StaffingManagement";
import EntriesManagement from "../components/management/EntriesManagement";
import ShrinkageCategoryManagement from "../components/management/ShrinkageCategoryManagement";

// ============================================
// MANAGEMENT PAGE
// ============================================

export default function Management() {
  const [screen, setScreen] =
    useState("projects");

  const data = useData([
    "countries",
    "projects",
    "lobs",
    "capPlans",
    "languages",
    "fields",
    "dow",
    "hours",
    "pms",
  ]);

  const auth = useAuth();

  // ==========================================
  // MENU
  // ==========================================

  const menuItems = [
    {
      key: "projects",
      label: "Projects",
    },
    {
      key: "lobs",
      label: "Lobs",
    },
    {
      key: "capPlans",
      label: "Cap Plans",
    },
    {
      key: "shrinkageCategories",
      label: "Shrinkage Categories",
      adminOnly: true,
    },
    {
      key: "entries",
      label: "Entries",
    },
    {
      key: "staffing",
      label: "Staffing",
    },
  ];

  // ==========================================
  // ACTIVE SCREEN
  // ==========================================

  const renderScreen = () => {
    switch (screen) {
      case "projects":
        return (
          <ProjectManagement
            data={data}
          />
        );

      case "lobs":
        return (
          <LobManagement
            data={data}
          />
        );

      case "capPlans":
        return (
          <CapPlanManagement
            data={data}
          />
        );

      case "shrinkageCategories":
        return (
          <ShrinkageCategoryManagement />
        );

      case "entries":
        return (
          <EntriesManagement
            data={data}
          />
        );

      case "staffing":
        return (
          <StaffingManagement
            data={data}
          />
        );

      default:
        return (
          <ProjectManagement
            data={data}
          />
        );
    }
  };

  return (
    <>
      <Head>
        <title>
          Planning App | Management
        </title>
      </Head>

      <div>
        <h1 className="has-text-centered mb-2 is-size-5">
          MANAGEMENT
        </h1>

        <div className="columns">
          {/* ============================== */}
          {/* MANAGEMENT MENU */}
          {/* ============================== */}

          <div
            className="column is-narrow"
            style={{
              minWidth: "220px",
            }}
          >
            <div className="panel">
              <h2 className="panel-heading is-size-6">
                MANAGEMENT SETUP
              </h2>

              {menuItems
                .filter(
                  (menuItem) =>
                    !menuItem.adminOnly ||
                    auth.allowedAdmin
                )
                .map((menuItem) => {
                  const isActive =
                    screen ===
                    menuItem.key;

                  return (
                    <a
                      key={
                        menuItem.key
                      }
                      className={`panel-block ${
                        isActive
                          ? "is-active"
                          : ""
                      }`}
                      onClick={() =>
                        setScreen(
                          menuItem.key
                        )
                      }
                      style={{
                        cursor:
                          "pointer",

                        borderLeft:
                          isActive
                            ? "3px solid #4b4bf9"
                            : "3px solid transparent",

                        background:
                          isActive
                            ? "#f3f3f7"
                            : undefined,

                        color:
                          isActive
                            ? "#4b4bf9"
                            : undefined,

                        fontWeight:
                          isActive
                            ? 600
                            : 400,
                      }}
                    >
                      {menuItem.label}
                    </a>
                  );
                }
              )}
            </div>
          </div>

          {/* ============================== */}
          {/* MANAGEMENT CONTENT */}
          {/* ============================== */}

          <div className="column">
            {!auth.allowedManager ? (
              <div className="message is-danger is-size-5 px-5 py-5">
                <span>
                  <FaLock />
                </span>{" "}
                UNAUTHORIZED ACCESS
              </div>
            ) : screen ===
                "shrinkageCategories" &&
              !auth.allowedAdmin ? (
              <div className="message is-warning px-5 py-5">
                <span>
                  <FaLock />
                </span>{" "}
                Administrator permission is required to manage shrinkage categories.
              </div>
            ) : (
              renderScreen()
            )}
          </div>
        </div>
      </div>
    </>
  );
}