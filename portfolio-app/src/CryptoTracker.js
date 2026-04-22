import React, { useState, useEffect, useRef, useCallback } from 'react';

const STORAGE_KEY = "andy-crypto-v1";
const CHAT_KEY = "andy-crypto-chat-v1";

// Binance public market data endpoint - no API key needed, CORS-enabled
const BINANCE_API = "/api/binance";

const DEFAULT_POSITIONS = [
  { id: 1, symbol: "BTCUSDT", ticker: "BTC", name: "Bitcoin", amount: 0, cost: 0, wallet: "Ledger" },
  { id: 2, symbol: "ETHUSDT", ticker: "ETH", name: "Ethereum", amount: 0, cost: 0, wallet: "Ledger" },
  { id: 3, symbol: "SOLUSDT", ticker: "SOL", name: "Solana", amount: 0, cost: 0, wallet: "Coinbase" },
];

// Binance trading pair symbols
const BINANCE_SYMBOLS = {
  "BTC": "BTCUSDT", "ETH": "ETHUSDT", "SOL": "SOLUSDT", "ADA": "ADAUSDT",
  "XRP": "XRPUSDT", "DOGE": "DOGEUSDT", "DOT": "DOTUSDT", "AVAX": "AVAXUSDT",
  "LINK": "LINKUSDT", "UNI": "UNIUSDT", "LTC": "LTCUSDT", "XLM": "XLMUSDT",
  "SHIB": "SHIBUSDT", "PEPE": "PEPEUSDT", "SUI": "SUIUSDT", "APT": "APTUSDT",
  "NEAR": "NEARUSDT", "MATIC": "MATICUSDT", "ATOM": "ATOMUSDT", "SAND": "SANDUSDT",
  "HYPE": "HYPEUSDT", "BTCH": "BTCHUSDT",
};

function fmt(n, d = 2) { return n?.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }) ?? "—"; }
function fmtUSD(n) { const a = Math.abs(n); return (n < 0 ? "-$" : "$") + a.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtCrypto(n) { if (!n && n !== 0) return "—"; if (n >= 1) return fmt(n, 4); if (n >= 0.0001) return fmt(n, 6); return n.toExponential(4); }

const WALLET_COLORS = { "Ledger": "#7c3aed", "Trezor": "#0891b2", "Coinbase": "#1d4ed8", "Other": "#b45309" };

export default function CryptoTracker() {
  const [positions, setPositions] = useState(DEFAULT_POSITIONS);
  const [prices, setPrices] = useState({});
  const [changes24h, setChanges24h] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [priceError, setPriceError] = useState(false);
  const [chat, setChat] = useState([{ role: "assistant", text: "Hey Andy! Live crypto prices via Binance. Ask me anything about your portfolio!" }]);
  const [input, setInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("portfolio");
  const [editingId, setEditingId] = useState(null);
  const [editVals, setEditVals] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [newPos, setNewPos] = useState({ ticker: "", name: "", symbol: "", amount: "", cost: "", wallet: "Coinbase" });
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const nextId = useRef(100);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) { try { setPositions(JSON.parse(saved) || DEFAULT_POSITIONS); } catch {} }
    const savedChat = localStorage.getItem(CHAT_KEY);
    if (savedChat) { try { setChat(JSON.parse(savedChat)); } catch {} }
  }, []);

  function save(pos) { localStorage.setItem(STORAGE_KEY, JSON.stringify(pos)); }
  function saveChat(msgs) { localStorage.setItem(CHAT_KEY, JSON.stringify(msgs.slice(-40))); }

  const fetchPrices = useCallback(async (overridePos) => {
    const pos = overridePos || positions;
    setRefreshing(true); setPriceError(false);
    try {
      const symbols = [...new Set(pos.map(p => BINANCE_SYMBOLS[p.ticker] || p.symbol).filter(Boolean))];
      // Binance ticker/24hr endpoint supports multiple symbols
      const symbolsParam = JSON.stringify(symbols);
      const res = await fetch(`${BINANCE_API}/ticker/24hr?symbols=${encodeURIComponent(symbolsParam)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const p = {}, c = {};
      data.forEach(d => {
        const price = parseFloat(d.lastPrice);
        const change = parseFloat(d.priceChangePercent);
        p[d.symbol] = price;
        c[d.symbol] = change;
        // Also map by short ticker
        const ticker = d.symbol.replace("USDT", "");
        p[ticker] = price;
        c[ticker] = change;
      });
      if (Object.keys(p).length > 0) { setPrices(p); setChanges24h(c); setLastUpdated(new Date()); }
      else setPriceError(true);
    } catch (e) {
      console.error("Price fetch error:", e);
      setPriceError(true);
    }
    setRefreshing(false);
  }, [positions]);

  useEffect(() => { fetchPrices(); }, []);
  useEffect(() => { const t = setInterval(() => fetchPrices(), 60000); return () => clearInterval(t); }, [fetchPrices]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);

  function getPrice(p) {
    const sym = BINANCE_SYMBOLS[p.ticker] || p.symbol;
    return prices[sym] || prices[p.ticker] || 0;
  }
  function getChange(p) {
    const sym = BINANCE_SYMBOLS[p.ticker] || p.symbol;
    return changes24h[sym] || changes24h[p.ticker] || 0;
  }

  const enriched = positions.map(p => {
    const price = getPrice(p);
    const value = p.amount * price;
    const gain = value - p.cost;
    const gainPct = p.cost > 0 ? (gain / p.cost) * 100 : null;
    return { ...p, price, value, gain, gainPct, change24h: getChange(p) };
  });

  const totalValue = enriched.reduce((s, p) => s + p.value, 0);
  const totalCost = enriched.reduce((s, p) => s + p.cost, 0);
  const totalGain = totalValue - totalCost;
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
  const walletBreakdown = enriched.reduce((acc, p) => { acc[p.wallet] = (acc[p.wallet] || 0) + p.value; return acc; }, {});

  function buildSummary() {
    const rows = enriched.map(p => `${p.ticker}: ${fmtCrypto(p.amount)} @ $${p.price >= 1 ? fmt(p.price) : p.price.toFixed(6)} = ${fmtUSD(p.value)} | cost ${fmtUSD(p.cost)} | gain ${fmtUSD(p.gain)}${p.gainPct !== null ? ` (${fmt(p.gainPct)}%)` : ""} | 24h: ${fmt(p.change24h)}% | ${p.wallet}`).join("\n");
    return `Andy's crypto:\n${rows}\nTotal: ${fmtUSD(totalValue)} | Gain: ${fmtUSD(totalGain)} (${fmt(totalGainPct)}%)\nWallets: ${Object.entries(walletBreakdown).map(([w, v]) => `${w}: ${fmtUSD(v)}`).join(", ")}\nPrices live via Binance.`;
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
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system: `Sharp crypto assistant for Andy. Live Binance data below. Concise.\n\n${buildSummary()}`, messages: newChat.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.text })) }),
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || "Couldn't get a response.";
      const updated = [...newChat, { role: "assistant", text: reply }];
      setChat(updated); saveChat(updated);
    } catch { setChat([...newChat, { role: "assistant", text: "Something went wrong. Try again!" }]); }
    setAiLoading(false);
  }

  function addPosition() {
    if (!newPos.ticker) return;
    const ticker = newPos.ticker.toUpperCase();
    const symbol = newPos.symbol || BINANCE_SYMBOLS[ticker] || ticker + "USDT";
    const pos = { id: nextId.current++, symbol, ticker, name: newPos.name || ticker, amount: parseFloat(newPos.amount) || 0, cost: parseFloat(newPos.cost) || 0, wallet: newPos.wallet };
    const updated = [...positions, pos];
    setPositions(updated); save(updated);
    setNewPos({ ticker: "", name: "", symbol: "", amount: "", cost: "", wallet: "Coinbase" });
    setShowAdd(false);
    setTimeout(() => fetchPrices(updated), 300);
  }

  const iStyle = { background: "#080810", border: "1px solid #2d1b69", borderRadius: 6, color: "#e0d8f8", padding: "5px 8px", fontSize: 12, outline: "none", fontFamily: "monospace", width: 90 };
  const QUICK = ["How's my portfolio doing?", "Which coin is up most today?", "Should I rebalance?", "Portfolio health check"];

  return (
    <div style={{ color: "#e0d8f8" }}>
      <div style={{ background: "linear-gradient(135deg, #080810 0%, #0d0d2a 50%, #080810 100%)", borderBottom: "1px solid #2d1b69", padding: "20px 24px 0" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 4, color: "#7c3aed", textTransform: "uppercase", marginBottom: 4 }}>Crypto Portfolio</div>
            <div style={{ fontSize: 26, fontWeight: "bold" }}>Holdings</div>
          </div>
          <div style={{ textAlign: "right", paddingBottom: 4 }}>
            <div style={{ fontSize: 30, fontWeight: "bold", color: totalGain >= 0 ? "#a78bfa" : "#f87171", fontFamily: "monospace" }}>{fmtUSD(totalValue)}</div>
            <div style={{ fontSize: 13, color: totalGain >= 0 ? "#a78bfa" : "#f87171" }}>{totalGain >= 0 ? "▲" : "▼"} {fmtUSD(Math.abs(totalGain))} ({fmt(Math.abs(totalGainPct))}%) all time</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ background: "#0d0d2a", border: "1px solid #2d1b69", borderRadius: 8, padding: "5px 12px", fontSize: 12 }}>
            <span style={{ color: "#7c5cbf" }}>Holdings: </span><span style={{ fontFamily: "monospace", fontWeight: "bold" }}>{positions.length}</span>
          </div>
          <button onClick={() => fetchPrices()} disabled={refreshing} style={{ marginLeft: "auto", background: "#0d0d2a", border: "1px solid #2d1b69", borderRadius: 8, color: refreshing ? "#4a3a6a" : "#a78bfa", padding: "5px 14px", cursor: refreshing ? "not-allowed" : "pointer", fontSize: 12 }}>
            <span style={{ display: "inline-block", animation: refreshing ? "spin 1s linear infinite" : "none" }}>↻</span> {refreshing ? "Updating..." : lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Fetch Live Prices"}
          </button>
          {priceError && <span style={{ fontSize: 11, color: "#f87171" }}>⚠ Price fetch failed — check console</span>}
        </div>

        <div style={{ display: "flex", marginTop: 16 }}>
          {["portfolio", "allocation", "ai-chat"].map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{ background: activeTab === t ? "#0d0d2a" : "transparent", border: "none", borderTop: activeTab === t ? "2px solid #7c3aed" : "2px solid transparent", color: activeTab === t ? "#e0d8f8" : "#5a4a8a", padding: "10px 20px", cursor: "pointer", fontSize: 13, letterSpacing: 1, textTransform: "uppercase" }}>
              {t === "portfolio" ? "🪙 Holdings" : t === "allocation" ? "🥧 Allocation" : "🤖 AI Chat"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px 24px", maxWidth: 1100, margin: "0 auto" }}>
        {activeTab === "portfolio" && (
          <div>
            <div style={{ background: "#0d0d2a", border: "1px solid #2d1b69", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #2d1b69" }}>
                      {["Coin", "Amount", "Live Price", "24h", "Value", "Cost", "Gain/Loss", "G/L %", "Wallet", ""].map(h => (
                        <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#7c3aed", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {enriched.map((p, i) => {
                      const isEdit = editingId === p.id;
                      return (
                        <tr key={p.id} style={{ borderBottom: "1px solid #1a1a35", background: i % 2 === 0 ? "transparent" : "#090916" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#111128"}
                          onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "transparent" : "#090916"}>
                          <td style={{ padding: "12px 14px" }}>
                            <div style={{ fontFamily: "monospace", fontWeight: "bold", color: "#a78bfa" }}>{p.ticker}</div>
                            <div style={{ fontSize: 11, color: "#5a4a8a" }}>{p.name}</div>
                          </td>
                          <td style={{ padding: "12px 14px", fontFamily: "monospace" }}>
                            {isEdit ? <input type="number" value={editVals.amount} onChange={e => setEditVals({ ...editVals, amount: e.target.value })} style={iStyle} /> : fmtCrypto(p.amount)}
                          </td>
                          <td style={{ padding: "12px 14px", fontFamily: "monospace", color: p.price ? "#4ade80" : "#5a4a8a" }}>
                            {p.price ? <span>${p.price >= 1 ? fmt(p.price) : p.price.toFixed(6)} <span style={{ fontSize: 9, color: "#7c3aed" }}>LIVE</span></span> : <span style={{ color: "#f87171", fontSize: 11 }}>No price</span>}
                          </td>
                          <td style={{ padding: "12px 14px", fontFamily: "monospace", color: p.change24h >= 0 ? "#a78bfa" : "#f87171" }}>
                            {p.change24h ? `${p.change24h >= 0 ? "+" : ""}${fmt(p.change24h)}%` : "—"}
                          </td>
                          <td style={{ padding: "12px 14px", fontFamily: "monospace" }}>{p.value ? fmtUSD(p.value) : "—"}</td>
                          <td style={{ padding: "12px 14px", fontFamily: "monospace", color: "#5a4a8a" }}>
                            {isEdit ? <input type="number" value={editVals.cost} onChange={e => setEditVals({ ...editVals, cost: e.target.value })} style={iStyle} /> : fmtUSD(p.cost)}
                          </td>
                          <td style={{ padding: "12px 14px", fontFamily: "monospace", color: p.gain >= 0 ? "#a78bfa" : "#f87171" }}>{p.value ? (p.gain >= 0 ? "+" : "") + fmtUSD(p.gain) : "—"}</td>
                          <td style={{ padding: "12px 14px", fontFamily: "monospace", color: p.gainPct === null ? "#5a4a8a" : p.gainPct >= 0 ? "#a78bfa" : "#f87171" }}>{p.gainPct === null ? "—" : `${p.gainPct >= 0 ? "+" : ""}${fmt(p.gainPct)}%`}</td>
                          <td style={{ padding: "12px 14px" }}>
                            {isEdit
                              ? <select value={editVals.wallet} onChange={e => setEditVals({ ...editVals, wallet: e.target.value })} style={{ ...iStyle, width: 90 }}>{["Ledger", "Trezor", "Coinbase", "Other"].map(w => <option key={w}>{w}</option>)}</select>
                              : <span style={{ background: (WALLET_COLORS[p.wallet] || "#333") + "30", color: WALLET_COLORS[p.wallet] || "#aaa", border: `1px solid ${(WALLET_COLORS[p.wallet] || "#333")}50`, borderRadius: 4, padding: "2px 8px", fontSize: 11 }}>{p.wallet}</span>
                            }
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            {isEdit
                              ? <div style={{ display: "flex", gap: 5 }}>
                                  <button onClick={() => { const updated = positions.map(pos => pos.id === p.id ? { ...pos, amount: parseFloat(editVals.amount) || 0, cost: parseFloat(editVals.cost) || 0, wallet: editVals.wallet } : pos); setPositions(updated); save(updated); setEditingId(null); }} style={{ background: "#1a3a1a", border: "1px solid #4ade8040", borderRadius: 5, color: "#4ade80", padding: "4px 9px", cursor: "pointer", fontSize: 11 }}>Save</button>
                                  <button onClick={() => setEditingId(null)} style={{ background: "#3a1a1a", border: "1px solid #f8717140", borderRadius: 5, color: "#f87171", padding: "4px 9px", cursor: "pointer", fontSize: 11 }}>✕</button>
                                </div>
                              : <div style={{ display: "flex", gap: 5 }}>
                                  <button onClick={() => { setEditingId(p.id); setEditVals({ amount: p.amount, cost: p.cost, wallet: p.wallet }); }} style={{ background: "#1a1a35", border: "1px solid #2d1b69", borderRadius: 5, color: "#a78bfa", padding: "4px 9px", cursor: "pointer", fontSize: 11 }}>Edit</button>
                                  <button onClick={() => { const updated = positions.filter(pos => pos.id !== p.id); setPositions(updated); save(updated); }} style={{ background: "#3a1a1a", border: "1px solid #f8717140", borderRadius: 5, color: "#f87171", padding: "4px 9px", cursor: "pointer", fontSize: 11 }}>✕</button>
                                </div>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {showAdd ? (
              <div style={{ background: "#0d0d2a", border: "1px solid #2d1b69", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "#7c3aed", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>Add Coin</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                  {[["Ticker", "ticker", 70, "BTC"], ["Name", "name", 120, "Bitcoin"], ["Binance Pair", "symbol", 110, "BTCUSDT"], ["Amount", "amount", 90, "0.5"], ["Cost ($)", "cost", 90, "0"]].map(([label, key, w, ph]) => (
                    <div key={key}>
                      <div style={{ fontSize: 11, color: "#5a4a8a", marginBottom: 4 }}>{label}</div>
                      <input value={newPos[key]} onChange={e => { const val = key === "ticker" ? e.target.value.toUpperCase() : e.target.value; const auto = key === "ticker" ? (BINANCE_SYMBOLS[val] || "") : undefined; setNewPos({ ...newPos, [key]: val, ...(auto !== undefined ? { symbol: auto } : {}) }); }} style={{ ...iStyle, width: w }} placeholder={ph} />
                    </div>
                  ))}
                  <div>
                    <div style={{ fontSize: 11, color: "#5a4a8a", marginBottom: 4 }}>Wallet</div>
                    <select value={newPos.wallet} onChange={e => setNewPos({ ...newPos, wallet: e.target.value })} style={{ ...iStyle, width: 100 }}>{["Ledger", "Trezor", "Coinbase", "Other"].map(w => <option key={w}>{w}</option>)}</select>
                  </div>
                  <button onClick={addPosition} style={{ background: "#1a1a45", border: "1px solid #7c3aed", borderRadius: 6, color: "#a78bfa", padding: "7px 16px", cursor: "pointer", fontSize: 12 }}>Add</button>
                  <button onClick={() => setShowAdd(false)} style={{ background: "#3a1a1a", border: "1px solid #f8717140", borderRadius: 6, color: "#f87171", padding: "7px 16px", cursor: "pointer", fontSize: 12 }}>Cancel</button>
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: "#5a4a8a" }}>Binance Pair is auto-filled for known tickers. For new coins, use format TICKERUSDT (e.g. HYPEUSDT).</div>
              </div>
            ) : (
              <button onClick={() => setShowAdd(true)} style={{ background: "#0d0d2a", border: "1px dashed #2d1b69", borderRadius: 8, color: "#7c3aed", padding: "10px 20px", cursor: "pointer", fontSize: 13, width: "100%", marginBottom: 16 }}>+ Add Coin</button>
            )}
          </div>
        )}

        {activeTab === "allocation" && (
          <div style={{ display: "grid", gap: 16 }}>
            {[{ title: "By Coin", items: [...enriched].sort((a, b) => b.value - a.value).map((p, i) => ({ label: p.ticker, value: p.value, color: ["#7c3aed","#a78bfa","#6d28d9","#8b5cf6","#c4b5fd","#4c1d95"][i % 6] })) },
              { title: "By Wallet", items: Object.entries(walletBreakdown).map(([w, v]) => ({ label: w, value: v, color: WALLET_COLORS[w] || "#7c3aed" })) }
            ].map(({ title, items }) => (
              <div key={title} style={{ background: "#0d0d2a", border: "1px solid #2d1b69", borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 11, color: "#7c3aed", letterSpacing: 3, textTransform: "uppercase", marginBottom: 16 }}>{title}</div>
                {items.map(item => {
                  const pct = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
                  return (
                    <div key={item.label} style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 13 }}>
                        <span style={{ fontFamily: "monospace", color: item.color, fontWeight: "bold" }}>{item.label}</span>
                        <span style={{ color: "#9a8abf" }}>{fmtUSD(item.value)} <span style={{ color: item.color }}>{fmt(pct)}%</span></span>
                      </div>
                      <div style={{ background: "#1a1a35", borderRadius: 4, height: 8, overflow: "hidden" }}>
                        <div style={{ background: item.color, width: `${pct}%`, height: "100%", borderRadius: 4, transition: "width 0.6s ease" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <div style={{ background: "#0d0d2a", border: "1px solid #2d1b69", borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 11, color: "#7c3aed", letterSpacing: 3, textTransform: "uppercase", marginBottom: 16 }}>24h Movers</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[...enriched].filter(p => p.change24h).sort((a, b) => b.change24h - a.change24h).map(p => (
                  <div key={p.id} style={{ background: p.change24h >= 0 ? "#1a0d35" : "#1a0d0d", border: `1px solid ${p.change24h >= 0 ? "#7c3aed" : "#7c1d1d"}40`, borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: "monospace", fontWeight: "bold" }}>{p.ticker}</span>
                    <span style={{ fontFamily: "monospace", color: p.change24h >= 0 ? "#a78bfa" : "#f87171", fontWeight: "bold" }}>{p.change24h >= 0 ? "+" : ""}{fmt(p.change24h)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "ai-chat" && (
          <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 300px)", minHeight: 400 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {QUICK.map(q => <button key={q} onClick={() => { setInput(q); inputRef.current?.focus(); }} style={{ background: "#0d0d2a", border: "1px solid #2d1b69", borderRadius: 20, color: "#a78bfa", padding: "6px 14px", cursor: "pointer", fontSize: 12 }}>{q}</button>)}
            </div>
            <div style={{ flex: 1, overflowY: "auto", background: "#0d0d2a", border: "1px solid #2d1b69", borderRadius: 12, padding: 16, marginBottom: 12 }}>
              {chat.map((m, i) => (
                <div key={i} style={{ marginBottom: 14, display: "flex", flexDirection: m.role === "user" ? "row-reverse" : "row", gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: m.role === "user" ? "#2d1b69" : "#1a0d35", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>{m.role === "user" ? "A" : "🤖"}</div>
                  <div style={{ maxWidth: "75%", background: m.role === "user" ? "#1a1a35" : "#0d0d1a", border: `1px solid ${m.role === "user" ? "#2d1b69" : "#1a0d35"}`, borderRadius: 10, padding: "10px 14px", fontSize: 13, lineHeight: 1.6, color: "#d0c8e8", whiteSpace: "pre-wrap" }}>{m.text}</div>
                </div>
              ))}
              {aiLoading && <div style={{ display: "flex", gap: 10 }}><div style={{ width: 28, height: 28, borderRadius: "50%", background: "#1a0d35", display: "flex", alignItems: "center", justifyContent: "center" }}>🤖</div><div style={{ background: "#0d0d1a", border: "1px solid #1a0d35", borderRadius: 10, padding: "10px 14px" }}><span style={{ display: "inline-flex", gap: 4 }}>{[0,1,2].map(j => <span key={j} style={{ width: 6, height: 6, borderRadius: "50%", background: "#7c3aed", display: "inline-block", animation: `pulse 1s ease-in-out ${j*0.2}s infinite` }} />)}</span></div></div>}
              <div ref={chatEndRef} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage()} placeholder="Ask anything about your crypto..." style={{ flex: 1, background: "#0d0d2a", border: "1px solid #2d1b69", borderRadius: 10, color: "#e0d8f8", padding: "12px 16px", fontSize: 14, outline: "none", fontFamily: "Georgia, serif" }} />
              <button onClick={sendMessage} disabled={aiLoading} style={{ background: "#1a1a45", border: "1px solid #7c3aed", borderRadius: 10, color: aiLoading ? "#4a3a6a" : "#a78bfa", padding: "12px 20px", cursor: aiLoading ? "not-allowed" : "pointer", fontSize: 14 }}>{aiLoading ? "..." : "Send →"}</button>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1.1)}} @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} input::-webkit-outer-spin-button,input::-webkit-inner-spin-button{-webkit-appearance:none} input[type=number]{-moz-appearance:textfield}`}</style>
    </div>
  );
}
