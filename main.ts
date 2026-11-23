// Steady Helm — a cbBTC trading bot for make.fun's btc-race-24h-20261123-0511.
//
// The idea, in one paragraph: one-minute bars of BTC are mostly noise (about 8 bps of
// wiggle a minute) while a full round trip costs about 26 bps in fees, slippage and
// price impact, so any rule that trades often bleeds out. Backtested on the frozen
// 24-hour dev window, fast trend rules (EMA 8/21, RSI/Bollinger, Donchian) all lose
// money on whipsaws, and plain buy-and-hold makes +$32.17. So this bot holds through
// the chop like buy-and-hold, but with two guards for the unseen race window:
//
//   - Entry: buy with the whole cash on the first tradeable bar, then hold.
//   - Trailing stop: while holding, track peak equity (cash + position at the latest
//     close); if equity falls 2.5% below its peak, sell everything. On the dev window
//     the deepest drawdown is 1.98%, so the stop never fires there; on a falling race
//     window it caps the loss near -2.5% instead of riding the asset down.
//   - Re-entry: after a stop-out, buy again only when the 60-minute return tops
//     +0.8% (a real recovery, not a dead-cat bounce), and never in the last 30 bars
//     of the 1,440-bar window, where a fresh round trip has no time to pay for itself.
//
// Every decision is a pure function of the closes seen so far: no clock, no random
// numbers, no network, no files. The same bars always give the same orders, so the
// two graded executions match byte for byte.
//
// Backtest (offline replay of the kit's fill model, verified to the cent against
// `grade-local` on the buy-and-hold baseline): dev window net PnL +$32.17, 1 trade,
// max drawdown 1.98%. Stress scenarios built from the same window: a -6% V-dip
// recovers to +$53.95, a sustained -8% crash ends at +$4.76, a time-reversed
// (falling) window ends at -$20.00, where buy-and-hold would end at -$38.76.

import { runBars, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
/** Trailing stop: sell when equity falls to 975/1000 of its peak (a 2.5% drawdown). */
const TRAIL_NUM = 975n;
const TRAIL_DEN = 1000n;
/** Re-entry: the close must beat the close 60 bars ago by 8/1000 (0.8%). */
const REENTRY_WINDOW = 60;
const REENTRY_NUM = 1008n;
const REENTRY_DEN = 1000n;
/** The window is 1,440 bars; never open a fresh position in its last 30 bars. */
const NO_ENTRY_AFTER_SEQ = 1440 - 30;
/** Slippage cap on every order, 1% past the close it was decided on. */
const MAX_SLIPPAGE_BPS = 100;
/** Keep retrying the first entry while the window is open, in case a fill is ever
 *  refused (a gap past the slippage cap at the next open): an entry that never
 *  fills would leave the bot with zero trades and fail the dev gate, so the first
 *  buy is retried on every flat bar until it lands, up to the no-entry cutoff. */
const FIRST_ENTRY_LAST_SEQ = 1440 - 30;

/** Every CBBTC close seen, oldest first, as exact integers. */
const closes: bigint[] = [];
/** Peak equity while a position is open (0 while flat). */
let peakEquity = 0n;
/** Whether the first entry has ever filled (a position has been held). */
let entered = false;

await runBars({
  onBatch(state, batch) {
    for (const bar of batch.bars) {
      if (bar.symbol === SYMBOL) closes.push(BigInt(bar.c));
    }
    // Warm-up batches reject every order; only build history from them.
    if (state.warmingUp) return [];

    const close = state.close(SYMBOL);
    if (close === null) return [];
    const held = state.positions.get(SYMBOL);

    if (held !== undefined) {
      entered = true;
      if (state.equity > peakEquity) peakEquity = state.equity;
      if (state.equity * TRAIL_DEN <= peakEquity * TRAIL_NUM) {
        peakEquity = 0n;
        const sell: SellInput = {
          side: 'sell',
          symbol: SYMBOL,
          qty: held.qty,
          max_slippage_bps: MAX_SLIPPAGE_BPS,
        };
        return [sell];
      }
      return [];
    }

    // Flat: no position to trail, so the peak resets for the next entry.
    peakEquity = 0n;
    if (state.seq >= NO_ENTRY_AFTER_SEQ) return [];

    // First entry: buy on the first tradeable bar (retry a few bars if refused).
    let buy = !entered && state.seq <= FIRST_ENTRY_LAST_SEQ;
    // Re-entry after a stop-out: only on a real 60-minute recovery.
    if (!buy && entered && closes.length > REENTRY_WINDOW) {
      const old = closes[closes.length - 1 - REENTRY_WINDOW];
      buy = close * REENTRY_DEN > old * REENTRY_NUM;
    }
    if (!buy) return [];

    const room = state.weightRoom(SYMBOL);
    const notional = state.cash < room ? state.cash : room;
    if (notional < BigInt(state.hello.fees.min_notional_quote_units)) return [];
    const order: BuyInput = {
      side: 'buy',
      symbol: SYMBOL,
      notional_quote_units: notional,
      max_slippage_bps: MAX_SLIPPAGE_BPS,
    };
    return [order];
  },
});
