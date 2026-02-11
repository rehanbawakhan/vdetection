import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, requirePin = false }) {
  const { token, pinVerified } = useAuth();

  if (!token) return <Navigate to="/login" replace />;
  if (requirePin && !pinVerified) return <Navigate to="/settings" replace />;

  return children;
}
