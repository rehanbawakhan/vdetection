import React, { useMemo, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import DashboardPage from "./pages/DashboardPage";
import LibraryPage from "./pages/LibraryPage";
import SettingsPage from "./pages/SettingsPage";
import HistoryPage from "./pages/HistoryPage";
import LoginPage from "./pages/LoginPage";
import ProtectedRoute from "./routes/ProtectedRoute";
import { useAuth } from "./context/AuthContext";

import { apiGet } from "./api";

export default function App() {
  const { token } = useAuth();
  const [faces, setFaces] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyFilters, setHistoryFilters] = useState({ name: "", from: "", to: "" });

  // eslint-disable-next-line
  const refreshHistory = React.useCallback(async (overrideFilters) => {
    if (!token) return;
    const filters = overrideFilters || historyFilters;
    const q = new URLSearchParams();
    if (filters.name) q.set("name", filters.name);
    if (filters.from) q.set("from", filters.from);
    if (filters.to) q.set("to", filters.to);

    try {
      const res = await apiGet(`/api/history${q.toString() ? `?${q.toString()}` : ""}`, token);
      setHistory(res.data || []);
    } catch (err) {
      console.error("Failed to refresh history", err);
    }
  }, [token, historyFilters]);

  const shellClass = useMemo(() => (token ? "app-shell" : "app-shell auth-only"), [token]);

  return (
    <div className={shellClass}>
      {token && (
        <Sidebar
          faces={faces}
        />
      )}
      <main className="main-panel">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage
                  faces={faces}
                  setFaces={setFaces}
                  history={history}
                  refreshHistory={refreshHistory}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/library"
            element={
              <ProtectedRoute requirePin>
                <LibraryPage faces={faces} setFaces={setFaces} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <HistoryPage
                  history={history}
                  historyFilters={historyFilters}
                  setHistoryFilters={setHistoryFilters}
                  refreshHistory={refreshHistory}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to={token ? "/" : "/login"} replace />} />
        </Routes>
      </main>
    </div>
  );
}
