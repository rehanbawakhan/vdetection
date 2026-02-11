import React, { useMemo, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import DashboardPage from "./pages/DashboardPage";
import LibraryPage from "./pages/LibraryPage";
import SettingsPage from "./pages/SettingsPage";
import LoginPage from "./pages/LoginPage";
import ProtectedRoute from "./routes/ProtectedRoute";
import { useAuth } from "./context/AuthContext";

export default function App() {
  const { token } = useAuth();
  const [faces, setFaces] = useState([]);
  const [history, setHistory] = useState([]);

  const shellClass = useMemo(() => (token ? "app-shell" : "app-shell auth-only"), [token]);

  return (
    <div className={shellClass}>
      {token && <Sidebar faces={faces} history={history} />}
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
                  setHistory={setHistory}
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
