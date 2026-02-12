import React from "react";

export default function HistoryList({ history }) {
  if (!history || history.length === 0) {
    return <p className="history-empty">No detections yet.</p>;
  }

  return (
    <div className="history-list">
      {history.map((item, index) => (
        <div
          key={item.id || `${item.name}-${item.timestamp}-${index}`}
          className="history-item"
          style={{ animationDelay: `${Math.min(index * 40, 320)}ms` }}
        >
          <div className="history-avatar">
            {item.image ? <img src={item.image} alt={item.name} className="tiny-thumb large" /> : "?"}
          </div>
          <div>
            <div className="history-name">{item.name}</div>
            <small>{new Date(item.timestamp).toLocaleString()}</small>
          </div>
        </div>
      ))}
    </div>
  );
}
