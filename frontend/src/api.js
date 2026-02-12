const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

function buildAuthHeader(token) {
  // "cookie-session" is a local marker, not a JWT. Keep cookie auth as source of truth.
  if (!token || token === "cookie-session") return {};
  return { Authorization: `Bearer ${token}` };
}

async function parseResponse(res) {
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || "Request failed");
  }
  return res.json();
}

export async function apiGet(path, token) {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeader(token)
    }
  });
  return parseResponse(res);
}

export async function apiPost(path, body, token) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeader(token)
    },
    body: JSON.stringify(body)
  });
  return parseResponse(res);
}

export async function apiPut(path, body, token) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeader(token)
    },
    body: JSON.stringify(body)
  });
  return parseResponse(res);
}

export async function apiDelete(path, token) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeader(token)
    }
  });
  return parseResponse(res);
}

export { API_URL };
