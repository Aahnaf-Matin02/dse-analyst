# DSE AI Analyst

An AI-powered Bangladesh stock market analysis platform for Dhaka Stock Exchange (DSE) investors.

## Key Features

- **Real-Time Data Scraper**: Directly extracts trading tickers, company financials, indices, and updates from dse.com.bd.
- **Micro & Macro Market Analytics**: View broad index charts (DSEX, DSES, DS30) overlays alongside individual trading securities.
- **Machine Learning Predictive Envelopes**: Multi-variable trajectory envelopes indicating upper and lower confidence boundaries.
- **AI-Powered Loss Prevention**: Stop-loss calculators using historical asset volatility.
- **Sentiment News Intelligence**: Natural Language Processing (NLP) models classifying market-wide announcements.
- **AI Investor Academy**: Complete guides, real-time quizzes, and helpful FAQs regarding fundamental ratios, technical analysis, and model operations.

## Running Locally

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Create a `.env` file from `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Add your `GEMINI_API_KEY`.

3. **Start Development Server**:
   ```bash
   npm run dev
   ```

4. **Production Build**:
   ```bash
   npm run build
   ```

## Netlify Deployment Guide

Follow these steps to deploy **DSE AI Analyst** to Netlify production safely:

1. **Push project to GitHub**: Create a repository and push the entire codebase. Make sure `.env` is added to your `.gitignore`.
2. **Connect GitHub repository to Netlify**: Select your repository inside the Netlify console dashboards.
3. **Configure Build Settings**:
   - **Build Command**: `npm run build`
   - **Publish Directory**: `dist`
   - **Functions Directory**: `netlify/functions` (Netlify auto-detects this directory from `netlify.toml`)
4. **Configure Environment Variables**:
   Go to your **Netlify Dashboard → Site configuration → Environment variables** and click **Add a variable**.
   Add the following environment variables:
   - `GEMINI_API_KEY`: Your official Google Gemini API Key.
     * *Note*: If `GEMINI_API_KEY` is not present, the applet continues to work perfectly using deterministic local rule-based fallback mode, ensuring zero crashes and complete uptime.
     * *Note*: If `GEMINI_API_KEY` is present, rich, real-time context-grounded Live Gemini AI analysis is enabled.
     * *Warning*: Never commit real API keys to repository files or Git.
   - `GEMINI_MODEL`: `gemini-3.8-flash`
   - `NODE_VERSION`: `20`
   - `DSE_BASE_URL`: `https://dse.com.bd` (custom base URL fallback)
   - `DSE_LIVE_PRICES_PATH` / `DSE_LIVE_MARKET_PATH`: optional overrides for DSE's live JSON feed (defaults `/api/live/prices` and `/api/live/market`). DSE retired its old `latest_share_price_*.php` pages (they now return HTTP 410); the scraper falls back to the legacy copies at `old.dsebd.org` only if the JSON feed fails.
   - `SYNC_SECRET`: protects the full `POST /api/dse/sync`.
   - `DSE_COMPANY_PATH`: `/company/{symbol}`
   - `ADMIN_IMPORT_SECRET`: Your customized password (to authorize manual caching / fallback uploads if DSE blocks scraping).
5. **Deploy Site**: Click deploy and wait for the frontend Vite build and Netlify Functions bundling to succeed.
6. **Deploy Verification & Endpoints testing**:
   Verify the following endpoints load and return dynamic JSON payloads:
   - `/api/stocks` (Returns all parsed stock assets)
   - `/api/dse/status` (Live connection diagnostics)
   - `/api/dse/refresh` (POST, public and throttled: refreshes live prices and indices; used by the Reconnect button)
   - `/api/dse/sync` (POST, requires `SYNC_SECRET`: full multi-page synchronization)

## Investing.com Historical Data Integration Guide

This platform supports integrating real 3-year historical stock and index records from Investing.com via manual CSV exports.

⚠️ **Important Legal & Compliance Warning**:
Investing.com does NOT provide public APIs, and its terms of service strictly prohibit automated indexing, aggressive scraping, screen-scraping, and bypassing CAPTCHAs, Cloudflare, paywalls, or bot mitigation shields. To respect intellectual property and comply with all security policies, do NOT use automated scrapers. Only use manual CSV file exports downloaded through your official Web account.

### How to Import 3-Year Historical Datasets:

1. **Download CSV Exports from Investing.com**:
   - Access the *Historical Data* tab of your target stock (e.g., Grameenphone) or index (e.g., Dhaka Stock Exchange Broad - DSEX) on Investing.com.
   - Adjust the date range filter to include the last **3 years** (e.g., 2023 to 2026).
   - Click **Download Data** to export the CSV file.

2. **Place Raw CSV File(s) in the Workspace**:
   - Save stock CSV files matching their trading ticker as the filename (e.g., `GP.csv`, `BATBC.csv`) under:
     `data/history/imports/investing/stocks/`
   - Save index tracker CSV files (e.g., `DSEX.csv`, `DS30.csv`, `DSES.csv`) under:
     `data/history/imports/investing/indices/`

3. **Run the Normalization and Safe-Sanitizer Script**:
   - Open a terminal and execute the pipeline compiler:
     ```bash
     npm run import:investing-history
     ```
   - This script cleans, parses date strings (handling formats like `Jun 02, 2026` or `06/02/2026`), converts volume multipliers (e.g. `2.5M` into `2500000`), validates logical mathematical constraints (e.g. `High >= Close`), removes duplicates, and outputs standardized sorted CSV databases directly into:
     - `data/history/stocks/`
     - `data/history/indices/`
   - It also compiles comprehensive JSON audit reports under `data/history/errors/` and `data/history/processed/`.

