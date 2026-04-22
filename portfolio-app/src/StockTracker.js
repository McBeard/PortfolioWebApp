import React, { useState, useEffect, useRef } from 'react';

const STORAGE_KEY = "andy-stocks-v1";
const CHAT_KEY = "andy-stocks-chat-v1";

// Finnhub free API - works from browser, no CORS issues
// Get free key at finnhub.io - replace below
const FINNHUB_KEY = "d7kj2ipr01qiqbcujulgd7kj2ipr01qiqbcujum0";

const INITIAL_POSITIONS = [
  { ticker: "INTC", name: "Intel Corp", shares: 11, cost: 199.96 },
  { ticker: "AMC", name: "AMC Entertainment", shares: 35, cost: 98.70 },
  { ticker: "DAL", name: "Delta Air Lines", shares: 2, cost: 116.86 },
  { ticker: "VOOG", name: "Vanguard S&P 500 Growth ETF", shares: 1.06722, cost: 80.00 },
  { ticker: "MSFT", name: "Microsoft Corp", shares: 0.08348, cost: 40.00 },
  { ticker: "SOFI", name: "SoFi Technologies", shares: 0.76472, cost: 20.12 },
  { ticker: "SNAP", name: "Snap Inc", shares: 2, cost: 17.10 },
  { ticker: "NVDA", name: "Nvidia Corp", shares: 1, cost: 109.02 },
  { ticker: "CRWV", name: "CoreWeave Inc", shares: 1, cost: 43.75 },
];

function fmt(n, d = 2) { return n?.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }) ?? "—"; }
function fmtUSD(n) { const a = Math.abs(n); return (n < 0 ? "-$" : "$") + a.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

const AI_TICKERS = ["NVDA", "INTC", "CRWV", "MSFT"];

export default function StockTracker() {
  const [positions, setPositions] = useState(INITIAL_POSITIONS);
  const [prices, setPrices] = useState({});
  const [changes, setChanges] = useState({});
  const [cash, setCash] = useState(500.56);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [priceError, setPriceError] = useState(false);
  const [chat, setChat] = useState([{ role: "assistant", text: "Hey Andy! I'm your stock portfolio AI with live prices. Ask me anything about your holdings!" }]);
  const [input, setInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("portfolio");
  const [editingTicker, setEditingTicker] = useState(null);
  const [editVals, setEditVals] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [newPos, setNewPos] = useState({ ticker: "", name: "", shares: "", cost: "" });
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) { try { const d = JSON.parse(saved); setPositions(d.positions || INITIAL_POSITIONS); setCash(d.cash ?? 500.56); } catch {} }
    const savedChat = localStorage.getItem(CHAT_KEY);
    if (savedChat) { try { setChat(JSON.parse(savedChat)); } catch {} }
  }, []);

  function save(pos, cashVal) { localStorage.setItem(STORAGE_KEY, JSON.stringify({ positions: pos, cash: cashVal })); }
  function saveChat(msgs) { localStorage.setItem(CHAT_KEY, JSON.stringify(msgs.slice(-40))); }

  async function fetchPrices() {
    if (FINNHUB_KEY === "YOUR_FINNHUB_KEY_HERE") {
      setPriceError(true);
      return;
    }
    setRefreshing(true); setPriceError(false);
    try {
      const tickers = positions.map(p => p.ticker);
      const results = await Promise.allSettled(
        tickers.map(t => fetch(`https://finnhub.io/api/v1/quote?symbol=${t}&token=${FINNHUB_KEY}`).then(r => r.json()))
      );
      const p = {}, c = {};
      results.forEach((res, i) => {
        if (res.status === "fulfilled" && res.value?.c) {
          p[tickers[i]] = res.value.c;
          c[tickers[i]] = res.value.dp;
        }
      });
      if (Object.keys(p).length > 0) { setPrices(p); setChanges(c); setLastUpdated(new Date()); }
      else setPriceError(true);
    } catch { setPriceError(true); }
    setRefreshing(false);
  }

  useEffect(() => { fetchPrices(); }, []);
  useEffect(() => { const t = setInterval(fetchPrices, 120000); return () => clearInterval(t); }, [positions]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);

  const enriched = positions.map(p => {
    const price = prices[p.ticker] || p.cost / Math.max(p.shares, 0.0001);
    const value = p.shares * price;
    const gain = value - p.cost;
    const gainPct = p.cost > 0 ? (gain / p.cost) * 100 : null;
    return { ...p, price, value, gain, gainPct, change: changes[p.ticker] || 0, hasLive: !!prices[p.ticker] };
  });

  const totalValue = enriched.reduce((s, p) => s + p.value, 0) + cash;
  const totalCost = enriched.reduce((s, p) => s + p.cost, 0) + cash;
  const totalGain = enriched.reduce((s, p) => s + p.gain, 0);
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
  const aiValue = enriched.filter(p => AI_TICKERS.includes(p.ticker)).reduce((s, p) => s + p.value, 0);
  const aiPct = totalValue > 0 ? (aiValue / totalValue) * 100 : 0;

  function buildSummary() {
    const rows = enriched.map(p => `${p.ticker}: ${fmt(p.shares, 5)} shares @ $${fmt(p.price)} = ${fmtUSD(p.value)} | cost ${fmtUSD(p.cost)} | gain ${fmtUSD(p.gain)}${p.gainPct !== null ? ` (${fmt(p.gainPct)}%)` : ""} | 24h: ${fmt(p.change)}%`).join("\n");
    return `Andy's stock portfolio:\n${rows}\nCash: ${fmtUSD(cash)}\nTotal: ${fmtUSD(totalValue)} | Gain: ${fmtUSD(totalGain)} (${fmt(totalGainPct)}%) | AI exposure: ${fmt(aiPct)}%\nAMC note: house money from 2021 meme spike, speculative hold.`;
  }

  async function sendMessage() {
    if (!input.trim() || aiLoading) return;
    const msg = input.trim(); setInput("");
    const newChat = [...chat, { role: "user", text: msg }];
    setChat(newChat); setAiLoading(true);
    try {
      const ANTHROPIC_KEY = process.env.REACT_APP_ANTHROPIC_KEY;
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system: `Sharp stock assistant for Andy. Live data below. Concise and direct.\n\n${buildSummary()}`, messages: newChat.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.text })) }),
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || "Couldn't get a response.";
      const updated = [...newChat, { role: "assistant", text: reply }];
      setChat(updated); saveChat(updated);
    } catch { setChat([...newChat, { role: "assistant", text: "Something went wrong. Try again!" }]); }
    setAiLoading(false);
  }

  const iStyle = { background: "#060d18", border: "1px solid #1e3a5f", borderRadius: 6, color: "#e8e0d0", padding: "5px 8px", fontSize: 12, outline: "none", fontFamily: "monospace", width: 90 };
  const QUICK = ["Which position is hurting me most?", "How's my AI exposure?", "Should I trim anything?", "Rate my portfolio /10"];

  return (
    <div style={{ color: "#e8e0d0" }}>
      <div style={{ background: "linear-gradient(135deg, #0a0f1a 0%, #111827 100%)", borderBottom: "1px solid #1e3a5f", padding: "20px 24px 0" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 4, color: "#4a7fa5", textTransform: "uppercase", marginBottom: 4 }}>Stock Portfolio</div>
            <div style={{ fontSize: 26, fontWeight: "bold" }}>Holdings</div>
          </div>
          <div style={{ textAlign: "right", paddingBottom: 4 }}>
            <div style={{ fontSize: 30, fontWeight: "bold", color: totalGain >= 0 ? "#4ade80" : "#f87171", fontFamily: "monospace" }}>{fmtUSD(totalValue)}</div>
            <div style={{ fontSize: 13, color: totalGain >= 0 ? "#4ade80" : "#f87171" }}>{totalGain >= 0 ? "▲" : "▼"} {fmtUSD(Math.abs(totalGain))} ({fmt(Math.abs(totalGainPct))}%) all time</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
          {[{ l: "AI Exposure", v: `${fmt(aiPct)}%` }, { l: "Cash", v: fmtUSD(cash) }].map(s => (
            <div key={s.l} style={{ background: "#111827", border: "1px solid #1e3a5f", borderRadius: 8, padding: "5px 12px", fontSize: 12 }}>
              <span style={{ color: "#4a7fa5" }}>{s.l}: </span><span style={{ fontFamily: "monospace", fontWeight: "bold" }}>{s.v}</span>
            </div>
          ))}
          <button onClick={fetchPrices} disabled={refreshing} style={{ marginLeft: "auto", background: "#111827", border: "1px solid #1e3a5f", borderRadius: 8, color: refreshing ? "#2a4a6a" : "#7fb3d3", padding: "5px 14px", cursor: refreshing ? "not-allowed" : "pointer", fontSize: 12 }}>
            <span style={{ display: "inline-block", animation: refreshing ? "spin 1s linear infinite" : "none" }}>↻</span> {refreshing ? "Updating..." : lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Fetch Live Prices"}
          </button>
          {priceError && (
            <span style={{ fontSize: 11, color: "#f87171" }}>
              {FINNHUB_KEY === "YOUR_FINNHUB_KEY_HERE" ? "⚠ Add Finnhub API key in .env file" : "⚠ Price fetch failed"}
            </span>
          )}
        </div>

        <div style={{ display: "flex", marginTop: 16 }}>
          {["portfolio", "ai-chat"].map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{ background: activeTab === t ? "#111827" : "transparent", border: "none", borderTop: activeTab === t ? "2px solid #4a7fa5" : "2px solid transparent", color: activeTab === t ? "#e8e0d0" : "#4a7fa5", padding: "10px 20px", cursor: "pointer", fontSize: 13, letterSpacing: 1, textTransform: "uppercase" }}>
              {t === "portfolio" ? "📊 Holdings" : "🤖 AI Chat"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px 24px", maxWidth: 1100, margin: "0 auto" }}>
        {activeTab === "portfolio" && (
          <div>
            <div style={{ background: "#111827", border: "1px solid #1e3a5f", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #1e3a5f" }}>
                      {["Ticker", "Name", "Shares", "Price", "24h", "Value", "Cost", "Gain/Loss", "G/L %", ""].map(h => (
                        <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#4a7fa5", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {enriched.map((p, i) => {
                      const isAI = AI_TICKERS.includes(p.ticker);
                      const isEdit = editingTicker === p.ticker;
                      return (
                        <tr key={p.ticker} style={{ borderBottom: "1px solid #1a2a3a", background: i % 2 === 0 ? "transparent" : "#0d1520" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#162030"}
                          onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "transparent" : "#0d1520"}>
                          <td style={{ padding: "12px 14px", fontFamily: "monospace", fontWeight: "bold", color: "#7fb3d3" }}>
                            {p.ticker}{isAI && <span style={{ marginLeft: 4, fontSize: 9, background: "#1e3a5f", color: "#4a9eda", padding: "1px 5px", borderRadius: 4 }}>AI</span>}
                          </td>
                          <td style={{ padding: "12px 14px", color: "#9ab0c0", fontSize: 12 }}>{p.name}</td>
                          <td style={{ padding: "12px 14px", fontFamily: "monospace" }}>
                            {isEdit ? <input type="number" value={editVals.shares} onChange={e => setEditVals({ ...editVals, shares: e.target.value })} style={iStyle} /> : fmt(p.shares, p.shares % 1 === 0 ? 0 : 5)}
                          </td>
                          <td style={{ padding: "12px 14px", fontFamily: "monospace" }}>
                            {isEdit ? <input type="number" value={editVals.price} onChange={e => setEditVals({ ...editVals, price: e.target.value })} style={iStyle} /> : <span style={{ color: p.hasLive ? "#4ade80" : "#e8e0d0", fontSize: p.hasLive ? 12 : 13 }}>${fmt(p.price)}{p.hasLive && <span style={{ fontSize: 9, marginLeft: 3 }}>LIVE</span>}</span>}
                          </td>
                          <td style={{ padding: "12px 14px", fontFamily: "monospace", color: p.change >= 0 ? "#4ade80" : "#f87171" }}>
                            {p.change ? `${p.change >= 0 ? "+" : ""}${fmt(p.change)}%` : "—"}
                          </td>
                          <td style={{ padding: "12px 14px", fontFamily: "monospace" }}>{fmtUSD(p.value)}</td>
                          <td style={{ padding: "12px 14px", fontFamily: "monospace", color: "#6b8fa8" }}>
                            {isEdit ? <input type="number" value={editVals.cost} onChange={e => setEditVals({ ...editVals, cost: e.target.value })} style={iStyle} /> : fmtUSD(p.cost)}
                          </td>
                          <td style={{ padding: "12px 14px", fontFamily: "monospace", color: p.gain >= 0 ? "#4ade80" : "#f87171" }}>{p.gain >= 0 ? "+" : ""}{fmtUSD(p.gain)}</td>
                          <td style={{ padding: "12px 14px", fontFamily: "monospace", color: p.gainPct === null ? "#6b8fa8" : p.gainPct >= 0 ? "#4ade80" : "#f87171" }}>{p.gainPct === null ? "—" : `${p.gainPct >= 0 ? "+" : ""}${fmt(p.gainPct)}%`}</td>
                          <td style={{ padding: "12px 14px" }}>
                            {isEdit
                              ? <div style={{ display: "flex", gap: 5 }}>
                                  <button onClick={() => { const updated = positions.map(pos => pos.ticker === p.ticker ? { ...pos, shares: parseFloat(editVals.shares) || pos.shares, cost: parseFloat(editVals.cost) || pos.cost } : pos); setPositions(updated); save(updated, cash); setEditingTicker(null); }} style={{ background: "#1a3a1a", border: "1px solid #4ade8040", borderRadius: 5, color: "#4ade80", padding: "4px 9px", cursor: "pointer", fontSize: 11 }}>Save</button>
                                  <button onClick={() => setEditingTicker(null)} style={{ background: "#3a1a1a", border: "1px solid #f8717140", borderRadius: 5, color: "#f87171", padding: "4px 9px", cursor: "pointer", fontSize: 11 }}>✕</button>
                                </div>
                              : <div style={{ display: "flex", gap: 5 }}>
                                  <button onClick={() => { setEditingTicker(p.ticker); setEditVals({ shares: p.shares, cost: p.cost, price: p.price }); }} style={{ background: "#1a2a3a", border: "1px solid #1e3a5f", borderRadius: 5, color: "#7fb3d3", padding: "4px 9px", cursor: "pointer", fontSize: 11 }}>Edit</button>
                                  <button onClick={() => { const updated = positions.filter(pos => pos.ticker !== p.ticker); setPositions(updated); save(updated, cash); }} style={{ background: "#3a1a1a", border: "1px solid #f8717140", borderRadius: 5, color: "#f87171", padding: "4px 9px", cursor: "pointer", fontSize: 11 }}>✕</button>
                                </div>
                            }
                          </td>
                        </tr>
                      );
                    })}
                    <tr style={{ borderBottom: "1px solid #1a2a3a", background: "#0d1520" }}>
                      <td colSpan={5} style={{ padding: "12px 14px", color: "#6b8fa8", fontStyle: "italic", fontSize: 12 }}>Cash & Sweep</td>
                      <td style={{ padding: "12px 14px", fontFamily: "monospace" }}><input type="number" value={cash} onChange={e => { const v = parseFloat(e.target.value) || 0; setCash(v); save(positions, v); }} style={{ ...iStyle, width: 80 }} /></td>
                      <td colSpan={4} />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {showAdd ? (
              <div style={{ background: "#111827", border: "1px solid #1e3a5f", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "#4a7fa5", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>Add Position</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                  {[["Ticker", "ticker", 70], ["Name", "name", 140], ["Shares", "shares", 90], ["Cost ($)", "cost", 90]].map(([label, key, w]) => (
                    <div key={key}>
                      <div style={{ fontSize: 11, color: "#6b8fa8", marginBottom: 4 }}>{label}</div>
                      <input value={newPos[key]} onChange={e => setNewPos({ ...newPos, [key]: key === "ticker" ? e.target.value.toUpperCase() : e.target.value })} style={{ ...iStyle, width: w }} placeholder={label} />
                    </div>
                  ))}
                  <button onClick={() => { if (!newPos.ticker) return; const pos = { ticker: newPos.ticker, name: newPos.name || newPos.ticker, shares: parseFloat(newPos.shares) || 0, cost: parseFloat(newPos.cost) || 0 }; const updated = [...positions, pos]; setPositions(updated); save(updated, cash); setNewPos({ ticker: "", name: "", shares: "", cost: "" }); setShowAdd(false); }} style={{ background: "#1a2a3a", border: "1px solid #4a7fa5", borderRadius: 6, color: "#7fb3d3", padding: "7px 16px", cursor: "pointer", fontSize: 12 }}>Add</button>
                  <button onClick={() => setShowAdd(false)} style={{ background: "#3a1a1a", border: "1px solid #f8717140", borderRadius: 6, color: "#f87171", padding: "7px 16px", cursor: "pointer", fontSize: 12 }}>Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAdd(true)} style={{ background: "#111827", border: "1px dashed #1e3a5f", borderRadius: 8, color: "#4a7fa5", padding: "10px 20px", cursor: "pointer", fontSize: 13, width: "100%", marginBottom: 16 }}>+ Add Position</button>
            )}
          </div>
        )}

        {activeTab === "ai-chat" && (
          <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 280px)", minHeight: 400 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {QUICK.map(q => (
                <button key={q} onClick={() => { setInput(q); inputRef.current?.focus(); }} style={{ background: "#111827", border: "1px solid #1e3a5f", borderRadius: 20, color: "#7fb3d3", padding: "6px 14px", cursor: "pointer", fontSize: 12 }}>{q}</button>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: "auto", background: "#111827", border: "1px solid #1e3a5f", borderRadius: 12, padding: 16, marginBottom: 12 }}>
              {chat.map((m, i) => (
                <div key={i} style={{ marginBottom: 14, display: "flex", flexDirection: m.role === "user" ? "row-reverse" : "row", gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: m.role === "user" ? "#1e3a5f" : "#22543d", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>{m.role === "user" ? "A" : "🤖"}</div>
                  <div style={{ maxWidth: "75%", background: m.role === "user" ? "#1a2a3a" : "#0d1a0d", border: `1px solid ${m.role === "user" ? "#1e3a5f" : "#1a3a1a"}`, borderRadius: 10, padding: "10px 14px", fontSize: 13, lineHeight: 1.6, color: "#d8d0c0", whiteSpace: "pre-wrap" }}>{m.text}</div>
                </div>
              ))}
              {aiLoading && <div style={{ display: "flex", gap: 10 }}><div style={{ width: 28, height: 28, borderRadius: "50%", background: "#22543d", display: "flex", alignItems: "center", justifyContent: "center" }}>🤖</div><div style={{ background: "#0d1a0d", border: "1px solid #1a3a1a", borderRadius: 10, padding: "10px 14px" }}><span style={{ display: "inline-flex", gap: 4 }}>{[0,1,2].map(j => <span key={j} style={{ width: 6, height: 6, borderRadius: "50%", background: "#4a7fa5", display: "inline-block", animation: `pulse 1s ease-in-out ${j*0.2}s infinite` }} />)}</span></div></div>}
              <div ref={chatEndRef} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage()} placeholder="Ask anything about your stocks..." style={{ flex: 1, background: "#111827", border: "1px solid #1e3a5f", borderRadius: 10, color: "#e8e0d0", padding: "12px 16px", fontSize: 14, outline: "none", fontFamily: "Georgia, serif" }} />
              <button onClick={sendMessage} disabled={aiLoading} style={{ background: "#1e3a5f", border: "none", borderRadius: 10, color: "#7fb3d3", padding: "12px 20px", cursor: aiLoading ? "not-allowed" : "pointer", fontSize: 14 }}>{aiLoading ? "..." : "Send →"}</button>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1.1)}} @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} input::-webkit-outer-spin-button,input::-webkit-inner-spin-button{-webkit-appearance:none} input[type=number]{-moz-appearance:textfield}`}</style>
    </div>
  );
}
