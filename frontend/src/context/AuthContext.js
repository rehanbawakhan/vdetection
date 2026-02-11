import React, { createContext, useContext, useMemo, useState } from "react";
import { apiPost } from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [pinVerified, setPinVerified] = useState(localStorage.getItem("pinVerified") === "true");
  const [username, setUsername] = useState(localStorage.getItem("username") || "");

  const login = async (name, password) => {
    const result = await apiPost("/api/auth/login", { username: name, password });
    setToken(result.token);
    setUsername(name);
    localStorage.setItem("token", result.token);
    localStorage.setItem("username", name);
    return result;
  };

  const verifyPin = async (pin) => {
    if (!token) throw new Error("No auth token");
    await apiPost("/api/auth/pin", { pin }, token);
    setPinVerified(true);
    localStorage.setItem("pinVerified", "true");
  };

  const logout = () => {
    setToken(null);
    setPinVerified(false);
    setUsername("");
    localStorage.removeItem("token");
    localStorage.removeItem("pinVerified");
    localStorage.removeItem("username");
  };

  const value = useMemo(
    () => ({ token, pinVerified, username, login, verifyPin, logout }),
    [token, pinVerified, username]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
