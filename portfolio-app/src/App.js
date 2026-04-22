import React, { useState } from 'react';
import StockTracker from './StockTracker';
import CryptoTracker from './CryptoTracker';

export default function App() {
  const [tab, setTab] = useState('stocks');

  return (
    <div style={{ fontFamily: "'Georgia', serif", background: "#0a0f1a", minHeight: "100vh" }}>
      {/* Top nav */}
      <div style={{ background: "#060d18", borderBottom: "1px solid #1e3a5f", padding: "12px 24px", display: "flex", alignItems: "center", gap: 24 }}>
        <div style={{ fontSize: 13, fontWeight: "bold", color: "#4a7fa5", letterSpacing: 3, textTransform: "uppercase" }}>
          Andy's Command Center
        </div>
        <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
          {[["stocks", "📊 Stocks"], ["crypto", "🪙 Crypto"]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              background: tab === key ? "#1e3a5f" : "transparent",
              border: "1px solid " + (tab === key ? "#4a7fa5" : "#1e3a5f"),
              borderRadius: 8, color: tab === key ? "#e8e0d0" : "#4a7fa5",
              padding: "7px 18px", cursor: "pointer", fontSize: 13,
              transition: "all 0.2s", fontFamily: "Georgia, serif"
            }}>{label}</button>
          ))}
        </div>
      </div>

      {tab === 'stocks' ? <StockTracker /> : <CryptoTracker />}
    </div>
  );
}
