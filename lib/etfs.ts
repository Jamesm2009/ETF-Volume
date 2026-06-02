export type ETF = {
  ticker: string;
  name: string;
  category: string;
};

export const ETF_UNIVERSE: ETF[] = [
  // Broad US Equity
  { ticker: "SPY",  name: "S&P 500",                  category: "Broad US Equity" },
  { ticker: "QQQ",  name: "Nasdaq-100",                category: "Broad US Equity" },
  { ticker: "IWM",  name: "Russell 2000",              category: "Broad US Equity" },
  { ticker: "IJH",  name: "S&P Mid-Cap 400",           category: "Broad US Equity" },
  { ticker: "MGK",  name: "Mega Cap Growth",           category: "Broad US Equity" },
  { ticker: "SPYG", name: "S&P 500 Growth",            category: "Broad US Equity" },
  { ticker: "SPYV", name: "S&P 500 Value",             category: "Broad US Equity" },
  { ticker: "SPMO", name: "S&P 500 Momentum",          category: "Broad US Equity" },
  { ticker: "SPHB", name: "S&P 500 High Beta",         category: "Broad US Equity" },
  { ticker: "SPLV", name: "S&P 500 Low Volatility",    category: "Broad US Equity" },
  { ticker: "SDY",  name: "S&P Dividend Aristocrats",  category: "Broad US Equity" },

  // US Sectors
  { ticker: "XLK",  name: "Technology",                category: "US Sectors" },
  { ticker: "XLC",  name: "Communication Services",    category: "US Sectors" },
  { ticker: "XLY",  name: "Consumer Discretionary",    category: "US Sectors" },
  { ticker: "XLP",  name: "Consumer Staples",          category: "US Sectors" },
  { ticker: "XLI",  name: "Industrials",               category: "US Sectors" },
  { ticker: "XLU",  name: "Utilities",                 category: "US Sectors" },
  { ticker: "XLI",  name: "Industrials",               category: "US Sectors" },
  { ticker: "XRT",  name: "Retail",                    category: "US Sectors" },

  // International
  { ticker: "VGK",  name: "Europe",                    category: "International" },
  { ticker: "FEZ",  name: "Euro Stoxx 50",             category: "International" },
  { ticker: "EEM",  name: "Emerging Markets",          category: "International" },
  { ticker: "EMXC", name: "EM ex-China",               category: "International" },
  { ticker: "FXI",  name: "China Large Cap",           category: "International" },

  // Fixed Income
  { ticker: "AGG",  name: "US Aggregate Bond",         category: "Fixed Income" },
  { ticker: "IEF",  name: "7-10yr Treasury",           category: "Fixed Income" },
  { ticker: "TIP",  name: "TIPS",                      category: "Fixed Income" },
  { ticker: "MUB",  name: "Municipal Bond",            category: "Fixed Income" },
  { ticker: "HYG",  name: "High Yield Corp Bond",      category: "Fixed Income" },
  { ticker: "LQD",  name: "Inv Grade Corp Bond",       category: "Fixed Income" },
  { ticker: "GSY",  name: "Ultra Short Bond",          category: "Fixed Income" },
  { ticker: "SPMB", name: "Mortgage-Backed",           category: "Fixed Income" },

  // Commodities & Alternatives
  { ticker: "GLD",  name: "Gold",                      category: "Commodities & Alt" },
  { ticker: "DBC",  name: "Commodities Index",         category: "Commodities & Alt" },
  { ticker: "USO",  name: "Oil",                       category: "Commodities & Alt" },
  { ticker: "UUP",  name: "US Dollar",                 category: "Commodities & Alt" },
  { ticker: "IBIT", name: "Bitcoin",                   category: "Commodities & Alt" },
  { ticker: "CLI",  name: "Cantor Fitzgerald Income",  category: "Commodities & Alt" },
  { ticker: "CLRE", name: "Carbon Credits",            category: "Commodities & Alt" },
];

// Deduplicate (XLI appeared twice)
export const ETFS: ETF[] = ETF_UNIVERSE.filter(
  (etf, idx, arr) => arr.findIndex(e => e.ticker === etf.ticker) === idx
);

export const CATEGORIES = [...new Set(ETFS.map(e => e.category))];
