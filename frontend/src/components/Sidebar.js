import React from "react";
import { NavLink } from "react-router-dom";

export default function Sidebar({ faces }) {
  return (
    <aside className="sidebar glass-card">
      <h1 className="brand">FaceWatch AI</h1>
      <nav>
        <NavLink to="/" end className="nav-link">Dashboard</NavLink>
        <NavLink to="/library" className="nav-link">Library</NavLink>
        <NavLink to="/history" className="nav-link">History</NavLink>
        <NavLink to="/settings" className="nav-link">Settings</NavLink>
      </nav>

      <section className="panel-block">
        <h3>Face Library</h3>
        <div className="scroll-list">
          {faces.slice(0, 8).map((face) => (
            <div key={face.id} className="mini-row">
              <span>{face.name}</span>
              <span className={face.is_wanted ? "status wanted" : "status safe"}>
                {face.is_wanted ? "WANTED" : "KNOWN"}
              </span>
            </div>
          ))}
        </div>
      </section>


    </aside>
  );
}
