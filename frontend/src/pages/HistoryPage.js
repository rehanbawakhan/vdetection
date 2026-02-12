import React from "react";
import { apiDelete } from "../api";
import { useAuth } from "../context/AuthContext";
import HistoryList from "../components/HistoryList";

export default function HistoryPage({ history, historyFilters, setHistoryFilters, refreshHistory }) {
  const { token } = useAuth();

  React.useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  const applyFilter = () => {
    refreshHistory();
  };

  const clearHistory = async () => {
    if (window.confirm("Are you sure you want to delete all history logs?")) {
      await apiDelete("/api/history", token);
      refreshHistory();
    }
  };

  return (
    <div className="page-content">
      <div className="glass-card list-card">
        <h2>History Logs</h2>

        <div className="filter-bar" style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          <input
            placeholder="Name"
            value={historyFilters.name}
            onChange={(event) => setHistoryFilters({ ...historyFilters, name: event.target.value })}
            className="input-field"
          />
          <input
            type="date"
            value={historyFilters.from}
            onChange={(event) => setHistoryFilters({ ...historyFilters, from: event.target.value })}
            className="input-field"
          />
          <input
            type="date"
            value={historyFilters.to}
            onChange={(event) => setHistoryFilters({ ...historyFilters, to: event.target.value })}
            className="input-field"
          />
          <button onClick={applyFilter}>Apply Filter</button>
          <button
            onClick={() => {
              const empty = { name: "", from: "", to: "" };
              setHistoryFilters(empty);
              refreshHistory(empty);
            }}
          >
            Reset
          </button>
          <button
            style={{ backgroundColor: "#ff4d4d", color: "white", marginLeft: "auto" }}
            onClick={clearHistory}
          >
            Clear All History
          </button>
        </div>

        <HistoryList history={history} />
      </div>
    </div>
  );
}
