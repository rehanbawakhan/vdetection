
import React from "react";
import { apiDelete } from "../api";
import { useAuth } from "../context/AuthContext";

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
            <div className="glass-card" style={{ padding: "1rem", marginBottom: "1rem" }}>
                <h2>History Logs</h2>

                <div className="filter-bar" style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
                    <input
                        placeholder="Name"
                        value={historyFilters.name}
                        onChange={(e) => setHistoryFilters({ ...historyFilters, name: e.target.value })}
                        className="input-field"
                    />
                    <input
                        type="date"
                        value={historyFilters.from}
                        onChange={(e) => setHistoryFilters({ ...historyFilters, from: e.target.value })}
                        className="input-field"
                    />
                    <input
                        type="date"
                        value={historyFilters.to}
                        onChange={(e) => setHistoryFilters({ ...historyFilters, to: e.target.value })}
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

                <div className="history-list">
                    {history.length === 0 ? (
                        <p style={{ textAlign: "center", color: "#888" }}>No history logs found.</p>
                    ) : (
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", textAlign: "left" }}>
                                    <th style={{ padding: "0.5rem" }}>Image</th>
                                    <th style={{ padding: "0.5rem" }}>Name</th>
                                    <th style={{ padding: "0.5rem" }}>Timestamp</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((item) => (
                                    <tr key={item.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                        <td style={{ padding: "0.5rem" }}>
                                            {item.image ? <img src={item.image} alt={item.name} className="tiny-thumb" style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover" }} /> : "—"}
                                        </td>
                                        <td style={{ padding: "0.5rem" }}>{item.name}</td>
                                        <td style={{ padding: "0.5rem" }}>{new Date(item.timestamp).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
