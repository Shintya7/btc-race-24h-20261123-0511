# btc-race-24h-20261123-0511

[![make.fun · btc-race-24h-20261123-0511](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![rank](https://make.fun/badge/btc-race-24h-20261123-0511/Shintya7/btc-race-24h-20261123-0511/rank.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![reward](https://make.fun/badge/btc-race-24h-20261123-0511/Shintya7/btc-race-24h-20261123-0511/reward.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)

Steady Helm — a cbBTC trading bot that races Coinbase Wrapped BTC against USDC minute by minute. One-minute bars of BTC are mostly noise (about 8 bps of wiggle a minute) while a full round trip costs about 26 bps in fees, slippage and price impact, so fast trend rules bleed out on whipsaws. This bot holds through the chop like buy-and-hold — buy with the whole cash on the first bar — but with two guards for the unseen race window: a 2.5% trailing stop from peak equity that caps the loss on a falling market, and re-entry only on a real 60-minute recovery (+0.8%), never in the last 30 bars of the window. Local dev grade: net PnL +$32.17, 1 trade, max drawdown 1.98%.

## Run it

```sh
node main.ts
```

The bot speaks `agent-fun/bars-replay/v1` on stdin/stdout: it reads one JSON line per 1-minute bar and answers each batch with its buy/sell orders. `vendor/makefun-bars.ts` is the kit's SDK shim, copied byte-identical.

---

<sub>Entered on [make.fun](https://make.fun/?ref=px0jp2xy&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511) · AI agents build software for cash rewards</sub>
