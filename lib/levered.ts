export type LeveredETF = {
  ticker:     string;
  name:       string;
  bias:       "bull" | "bear";
  underlying: string;
};

export const LEVERED_ETFS: LeveredETF[] = [
  { ticker: "TSLL",  name: "Direxion Daily TSLA Bull 2X",       bias: "bull", underlying: "TSLA" },
  { ticker: "NVD",   name: "GraniteShares 2x Short NVDA",        bias: "bear", underlying: "NVDA" },
  { ticker: "PLTD",  name: "Direxion Daily PLTR Bear 1X",        bias: "bear", underlying: "PLTR" },
  { ticker: "TSLG",  name: "Leverage Shares 2X Long TSLA",       bias: "bull", underlying: "TSLA" },
  { ticker: "MSTU",  name: "T-Rex 2X Long MSTR Daily",           bias: "bull", underlying: "MSTR" },
  { ticker: "TSDD",  name: "GraniteShares 2x Short TSLA",        bias: "bear", underlying: "TSLA" },
  { ticker: "MSTZ",  name: "T-Rex 2X Inverse MSTR Daily",        bias: "bear", underlying: "MSTR" },
  { ticker: "AMDD",  name: "Direxion Daily AMD Bear 1X",         bias: "bear", underlying: "AMD"  },
  { ticker: "CONL",  name: "GraniteShares 2x Long COIN",         bias: "bull", underlying: "COIN" },
  { ticker: "GGLS",  name: "Direxion Daily GOOGL Bear 1X",       bias: "bear", underlying: "GOOGL"},
  { ticker: "NVDX",  name: "T-Rex 2X Long NVIDIA Daily",         bias: "bull", underlying: "NVDA" },
  { ticker: "NOWL",  name: "GraniteShares 2x Long NOW Daily",    bias: "bull", underlying: "NOW"  },
  { ticker: "IONZ",  name: "Defiance 2x Short IONQ",             bias: "bear", underlying: "IONQ" },
  { ticker: "OKLL",  name: "Defiance 2x Long OKLO",              bias: "bull", underlying: "OKLO" },
  { ticker: "AMZD",  name: "Direxion Daily AMZN Bear 1X",        bias: "bear", underlying: "AMZN" },
  { ticker: "AMDL",  name: "GraniteShares 2x Long AMD Daily",    bias: "bull", underlying: "AMD"  },
  { ticker: "AAPD",  name: "Direxion Daily AAPL Bear 1X",        bias: "bear", underlying: "AAPL" },
  { ticker: "NVDL",  name: "GraniteShares 2x Long NVDA",         bias: "bull", underlying: "NVDA" },
  { ticker: "MSFU",  name: "Direxion Daily MSFT Bull 2X",        bias: "bull", underlying: "MSFT" },
  { ticker: "MUD",   name: "Direxion Daily MU Bear 1X",          bias: "bear", underlying: "MU"   },
  { ticker: "TQQQ",  name: "ProShares UltraPro QQQ 3X",          bias: "bull", underlying: "QQQ"  },
  { ticker: "SQQQ",  name: "ProShares UltraPro Short QQQ 3X",    bias: "bear", underlying: "QQQ"  },
];
