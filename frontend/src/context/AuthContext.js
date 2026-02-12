import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem("session") || "");
  const [pinVerified, setPinVerified] = useState(localStorage.getItem("pinVerified") === "true");
  const [username, setUsername] = useState(localStorage.getItem("username") || "");
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    apiGet("/api/auth/me")
      .then((result) => {
        if (!mounted) return;
        setToken("cookie-session");
        setUsername(result.username || "");
        localStorage.setItem("session", "cookie-session");
        if (result.username) {
          localStorage.setItem("username", result.username);
        }
      })
      .catch(() => {
        if (!mounted) return;
        setToken("");
        setPinVerified(false);
        setUsername("");
        localStorage.removeItem("session");
        localStorage.removeItem("pinVerified");
        localStorage.removeItem("username");
      })
      .finally(() => {
        if (mounted) setAuthReady(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const login = async (name, password) => {
    const result = await apiPost("/api/auth/login", { username: name, password });
    setToken("cookie-session");
    setUsername(result.username || name);
    setPinVerified(false);
    localStorage.setItem("session", "cookie-session");
    localStorage.setItem("username", result.username || name);
    localStorage.removeItem("pinVerified");
    return result;
  };

  const faceLogin = async (name) => {
    const result = await apiPost("/api/auth/face-login", { username: name || "admin" });
    setToken("cookie-session");
    setUsername(result.username || name || "admin");
    setPinVerified(false);
    localStorage.setItem("session", "cookie-session");
    localStorage.setItem("username", result.username || name || "admin");
    localStorage.removeItem("pinVerified");
    return result;
  };

  const verifyPin = async (pin) => {
    if (!token) throw new Error("No auth session");
    await apiPost("/api/auth/pin", { pin });
    setPinVerified(true);
    localStorage.setItem("pinVerified", "true");
  };

  const logout = async () => {
    await apiPost("/api/auth/logout", {}).catch(() => { });
    setToken("");
    setPinVerified(false);
    setUsername("");
    localStorage.removeItem("session");
    localStorage.removeItem("pinVerified");
    localStorage.removeItem("username");
  };

  const value = useMemo(
    () => ({ token, pinVerified, username, authReady, login, faceLogin, verifyPin, logout }),
    [token, pinVerified, username, authReady]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
