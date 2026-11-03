import { Router } from "express";

const router = Router();

// Substantive Educational Articles data
const ARTICLES = [
  {
    id: "financial-ratios",
    title: "Understanding Financial Ratios on the Dhaka Stock Exchange",
    category: "Fundamental Analysis",
    icon: "Scale",
    readTime: "5 min read",
    summary: "A practical guide to valuation metrics like P/E, EPS, NAV, and Dividend Yield, tailored specifically for the DSE market.",
    sections: [
      {
        heading: "Introduction to Fundamental Ratios",
        body: "Financial ratios are key mathematical metrics derived from a company's financial statements (balance sheets, income statements, and cash flows) to determine relative valuation, profitability, and balance sheet strength. Evaluating these metrics helps separate long-term value from short-term speculative hype."
      },
      {
        heading: "Price-to-Earnings (P/E) Ratio",
        body: "The P/E Ratio tells you what price a shareholder is paying for BDT 1 of net earnings. It is calculated as: Stock Price / Earnings Per Share (EPS). For example, if a stock trades at BDT 150 and has an EPS of BDT 10, its P/E is 15. In the DSE context, a sovereign index average is generally around 12-15. Stocks with a P/E below 12 are often considered valuable value plays, while those above 25 represent premium high-growth or speculative sectors."
      },
      {
        heading: "Earnings Per Share (EPS)",
        body: "EPS measures the absolute portion of a company's profit allocated to each outstanding share of common stock. Calculated as: Net Income / Total Outstanding Shares. Steady EPS growth quarter-over-quarter is the most reliable hallmark of a scaling business model. Watch for temporary spikes from one-off asset sales, which don't represent sustainable core business growth."
      },
      {
        heading: "Net Asset Value (NAV)",
        body: "NAV represents a company's net book value per share — what's left for stockholders if the company liquidated all assets and paid off all liabilities immediately. In Bangladesh, many companies in manufacturing, textile, or material sectors are valued in comparison to their NAV. If a stock trades below its NAV per share, it's trading at a discount, offering deep asset protection."
      },
      {
        heading: "Dividend Yield",
        body: "Dividend Yield is calculated as: Annual Cash Dividend per share / Current Stock Price. Expressed as a percentage, it shows your baseline annual cash income return on the asset. Because many DSE investors favor steady income over capital appreciation, high-dividend blue-chips (like GP, BATBC, or LHBL) with historical dividend yields exceeding 6-8% serve as high-quality buffers against market declines."
      }
    ],
    glossary: [
      { term: "P/E Ratio", definition: "Price per share divided by annual profit per share. Measures relative cost." },
      { term: "EPS", definition: "Represented as total earnings divided by outstanding common shares. Indicates productivity." },
      { term: "NAV", definition: "Assets minus liabilities per share. Measures intrinsic book value." },
      { term: "Dividend Yield", definition: "Annual dividends divided by price. Reflects direct income returns." }
    ]
  },
  {
    id: "technical-indicators",
    title: "Introduction to Technical Oscillators & Trend Tracking",
    category: "Technical Analysis",
    icon: "Compass",
    readTime: "6 min read",
    summary: "Learn how Simple Moving Averages, Exponential Averages, RSI momentum, and volume breakouts assist in active trading timing.",
    sections: [
      {
        heading: "Understanding Technical Analysis",
        body: "Technical analysis assumes that all known information about a business is already priced in by the collective market, leaving price action and trading volume as the ultimate signals to study. Instead of 'what the firm is worth', technical analysis asks 'where the price trend is moving next'."
      },
      {
        heading: "Simple & Exponential Moving Averages (SMA & EMA)",
        body: "Moving averages smooth out short-term price noise to map prevailing trends over specific cycles (e.g., 20 days or 50 days). Simple Moving Average (SMA) is an arithmetic average. Exponential Moving Average (EMA) places more weight on recent trading sessions, responding faster to price shifts. When a short-term moving average crosses above a long-term moving average (often referred to as a 'Golden Cross'), technical analysts study it as a signal of shifting momentum. However, moving averages lag behind actual price events and do not convey whether underlying business earnings justify the move."
      },
      {
        heading: "Relative Strength Index (RSI)",
        body: "RSI is a momentum oscillator scaling from 0 to 100. It measures the velocity and magnitude of recent price moves. Broadly, an RSI above 70 indicates that a stock has experienced rapid upward momentum and is entering 'Overbought' territory. An RSI under 30 indicates 'Oversold' conditions, showing heavy downward pressure. What RSI cannot tell you is why the price moved: a company facing real insolvency may remain oversold for months, while high-growth firms can sustain elevated RSI during business expansions."
      },
      {
        heading: "Volume as a Confirmation Shield",
        body: "A price jump on low volume has zero structural conviction and could be a trap. Conversely, a price breakout accompanied by a spike in trading volume indicates institutional accumulation (block trades) and validates the momentum. Always cross-reference price breakouts with volume changes."
      }
    ],
    glossary: [
      { term: "Golden Cross", definition: "When a shorter-term moving average crosses above a long-term moving average, marking a long-term bullish trend swap." },
      { term: "RSI Oscillator", definition: "A 0-100 gauge showing price change speed. Highlights exhaustion points." },
      { term: "Volume Support", definition: "Using high trading volumes to confirm that a price breakout is real and backed by institutional capital." }
    ]
  },
  {
    id: "ai-price-prediction",
    title: "How AI & ML Models Predict Stock Pricing Boundaries",
    category: "AI Analytics",
    icon: "BrainCircuit",
    readTime: "6 min read",
    summary: "An inside look at Neural Networks, LSTM predictive modeling, and how sentiment natural language analysis guides the AI's predictions.",
    sections: [
      {
        heading: "The Limits of Traditional Regression",
        body: "Traditional models like linear regression assume a simple straight-line relationship which is immediately defeated by the multi-variable chaos of a live stock market. Deep learning algorithms adapt to complex, non-linear relationships by combining hundreds of layers of parameters."
      },
      {
        heading: "LSTM Recurrent Networks explained",
        body: "Long Short-Term Memory (LSTM) is a recurrent neural network architecture designed specifically to manage sequence data like time-series stock prices. Unlike general neural networks, LSTMs operate with selective memory blocks. They track long-term historical support basins while simultaneously giving weight to recent high-impact daily moving averages, letting them approximate complex future trajectory curves."
      },
      {
        heading: "NLP: Parsing Market Sentiment",
        body: "The AI Analyst doesn't just look at charts; it reads language. Using Natural Language Processing (NLP), a sentiment model parses crawls of DSE regulatory updates, financial circulars, and primary news media. The model assigns daily sentiment scores from -100 (Extremely Bearish) to +100 (Extremely Bullish) to shift prediction boundaries dynamically as new events unfold."
      },
      {
        heading: "Why a 'Predictive Envelope' Is Imperative",
        body: "No computer model can guarantee an exact stock price for tomorrow. A predictive algorithm that gives a single point estimate is highly misleading. In financial analysis, 'Predictive Envelopes' are probabilistic channels that showcase upper and lower statistical dispersion corridors. This illustrates to learners that market movements inherently carry uncertainty and standard deviations rather than predictable target paths."
      }
    ],
    glossary: [
      { term: "LSTM", definition: "Long Short-Term Memory. A sequential deep-learning architecture that handles time-series charts." },
      { term: "NLP Sentiment", definition: "Using algorithms to evaluate textual news severity and map it as quantitative pricing adjustments." },
      { term: "Predictive Envelope", definition: "The statistical channel mapping price dispersion corridors to help learners visualize market volatility." }
    ]
  }
];

// Structural FAQs
const FAQS = [
  {
    id: "faq_1",
    question: "How often are the stock data and indicators on this platform updated?",
    category: "Data & Platform Sync",
    answer: "Our scraper service queries the official Dhaka Stock Exchange tickers periodically. Normal prices are updated in real-time or near-real-time depending on server load, while fundamental indices and technical indicators like moving averages are compiled post-market closure daily."
  },
  {
    id: "faq_2",
    question: "What is a 'healthy' P/E Ratio baseline on the Dhaka Stock Exchange (DSE)?",
    category: "Fundamental Valuation",
    answer: "While it varies by industry sector, a trailing P/E ratio between 10 and 15 is generally considered a fair baseline for manufacturing, banking, and pharmaceutical stocks on the DSE. Speculative sectors or companies with massive earnings expectations can command P/Es of 25+, but they present heightened volatility risks."
  },
  {
    id: "faq_3",
    question: "Can these AI predictions guarantee actual profits?",
    category: "AI Predictive Models",
    answer: "No. All machine learning predictions are statistical estimates based on historical variables, patterns, and current news sentiment. They reflect mathematical probabilities rather than certainties. These models are educational learning tools and must never be treated as trading recommendations."
  },
  {
    id: "faq_4",
    question: "What is the difference between DS30, DSEX, and DSES indices?",
    category: "General Market Knowledge",
    answer: "DSEX is the broad market index spanning major eligible listed companies. DS35/DS30 is the elite blue-chip index consisting of 30 of the largest, most liquid, and fundamentally robust listings. DSES is the DSE Shariah Index, which filters and tracks listed assets that are compliant with Islamic Shariah guidelines."
  },
  {
    id: "faq_5",
    question: "How should a learner interpret risk threshold models?",
    category: "Risk Management",
    answer: "Under the Risk & Volatility tools, learners can explore simulated price drawdowns and volatility corridors. This demonstrates how sudden market downturns affect capital, teaching the importance of diversification, cash reserves, and systematic risk evaluation."
  }
];

// Interactive Quizzes questions
const QUIZZES = [
  {
    id: "quiz_1",
    question: "If Square Pharmaceuticals is trading at a stock price of BDT 210, and reports a trailing twelve-month Earnings Per Share (EPS) of BDT 21, what is its Price-to-Earnings (P/E) Ratio?",
    options: ["1.0", "5.0", "10.0", "21.0"],
    answerIndex: 2,
    explanation: "P/E is calculated as Stock Price divided by EPS. So, 210 / 21 = 10.0. This means investors pay BDT 10 for every BDT 1 of annual earnings."
  },
  {
    id: "quiz_2",
    question: "You observe that a stock's 14-day Relative Strength Index (RSI) momentum value has plummeted to 24. What primary state does this indicate about the share's current trading status?",
    options: [
      "The stock is in an 'Oversold' condition, suggesting momentum might be exhausted and a price bounce is possible.",
      "The stock is heavily 'Overbought', suggesting it is highly overvalued and a sudden collapse is imminent.",
      "The stock has ceased all trading on the Dhaka Stock Exchange.",
      "The Net Asset Value (NAV) of the business has dropped automatically by 24%."
    ],
    answerIndex: 0,
    explanation: "An RSI reading below 30 indicates 'Oversold' conditions. This suggests selling pressure is mathematically extreme, which frequently attracts bargain hunting and price rebounds."
  },
  {
    id: "quiz_3",
    question: "When analyzing AI price forecasts, what is the core benefit of looking at the 'Predictive Envelope margin' instead of a singular price target?",
    options: [
      "It allows you to calculate the stock trading commission fees accurately.",
      "It represents a probabilistically weighted range of outcomes, helping you identify and prepare for realistic market noise and volatility.",
      "It guarantees you will close trades at the absolute high point marked on the envelope.",
      "It changes color depending on whether you are logged into your account or browsing as a guest."
    ],
    answerIndex: 1,
    explanation: "Predictive Envelopes show high and low confidence boundaries. Since markets are non-linear and chaotic, tracking statistical corridors prevents chasing speculative numbers and assists in managing actual risk bounds."
  },
  {
    id: "quiz_4",
    question: "If a company on the DSE is trading at BDT 45, but its declared Net Asset Value (NAV) is BDT 65, what does this tell you about its pricing compared to its book value?",
    options: [
      "The company's liabilities are far greater than its physical asset holdings.",
      "The stock is trading at a discount to book value, meaning it offers high asset safety or deep value.",
      "The ticker is about to be delisted from the market.",
      "The dividend percentage will be forced to increase to 65% next quarter."
    ],
    answerIndex: 1,
    explanation: "When Stock Price is less than NAV per share, the market is pricing the equity below its net asset book value. This is a common indicator of a discounted deep-value stock."
  }
];

// GET /api/education/articles
router.get("/articles", (req, res, next) => {
  try {
    res.json(ARTICLES);
  } catch (err) {
    next(err);
  }
});

// GET /api/education/faqs
router.get("/faqs", (req, res, next) => {
  try {
    res.json(FAQS);
  } catch (err) {
    next(err);
  }
});

// GET /api/education/quizzes
router.get("/quizzes", (req, res, next) => {
  try {
    res.json(QUIZZES);
  } catch (err) {
    next(err);
  }
});

export const EducationRouter = router;
