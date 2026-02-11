import React from "react";
import { NavLink } from "react-router-dom";

export default function Sidebar({ faces, history }) {
  return (
    <aside className="sidebar glass-card">
      <h1 className="brand">FaceWatch AI</h1>
      <nav>
        <NavLink to="/" end className="nav-link">Dashboard</NavLink>
        <NavLink to="/library" className="nav-link">Library</NavLink>
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

      <section className="panel-block">
        <h3>History Logs</h3>
        <div className="scroll-list">
          {history.slice(0, 8).map((item) => (
            <div key={item.id} className="mini-row">
              <span className="history-cell">
                {item.image ? <img src={item.image} alt={item.name} className="tiny-thumb" /> : null}
                {item.name}
              </span>
              <small>{new Date(item.timestamp).toLocaleTimeString()}</small>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}
