# Andy's Portfolio Command Center

Your personal AI-powered stock + crypto tracker.

---

## 🚀 Deploy to Netlify (5 minutes)

### Step 1 — Get your free API keys

**Anthropic API key** (for the AI chat):
1. Go to console.anthropic.com
2. Sign in with your Anthropic account
3. Click "API Keys" → "Create Key"
4. Copy the key

**Finnhub API key** (for live stock prices):
1. Go to finnhub.io
2. Click "Get free API key"
3. Sign up (free, no credit card)
4. Copy your key from the dashboard

> **Crypto prices** use Binance's public API — no key needed!

---

### Step 2 — Set up on Netlify

1. Log into your Netlify account
2. Click **"Add new site"** → **"Deploy manually"**
3. Before deploying, go to **Site Settings → Environment Variables**
4. Add these two variables:
   - `REACT_APP_ANTHROPIC_KEY` = your Anthropic key
   - `REACT_APP_FINNHUB_KEY` = your Finnhub key

---

### Step 3 — Deploy

**Option A: Drag & Drop (easiest)**
1. Run `npm install && npm run build` on your computer
2. Drag the `build/` folder onto Netlify's deploy page

**Option B: Connect GitHub**
1. Push this folder to a GitHub repo
2. In Netlify: "Import from Git" → select your repo
3. Build command: `npm run build`
4. Publish directory: `build`
5. Click Deploy!

---

## 📱 Features

- **📊 Stocks** — All your positions with live prices via Finnhub
- **🪙 Crypto** — Full crypto portfolio with live Binance prices
- **🤖 AI Chat** — Ask anything about your portfolio
- **💾 Persistent** — Data saves in localStorage, survives page refreshes
- **🔄 Auto-refresh** — Prices update every 60-120 seconds

---

## 🪙 Adding Crypto Coins

For common coins (BTC, ETH, SOL, HYPE, BTCH etc.) the Binance pair auto-fills.
For new coins, use the Binance pair format: `TICKERUSDT` (e.g. `SUIUSDT`)

---

## 💡 Tips

- Update your stock **cost basis** and **shares** in the Edit fields
- Crypto **amount** = number of coins you hold (not dollars)
- Crypto **cost** = total dollars you paid
- The AI assistant knows your full portfolio in real time
