import { db } from './../db.js';

// Attach IQD-display fields to a list of transactions using the rate that
// was active on each transaction's date. Historical transactions are never
// re-priced — they use the rate that was true the day they were logged.

export function attachIqdFields(txns) {
  if (!txns.length) return txns;
  const rates = db
    .prepare(
      `SELECT effective_date, rate_iqd_per_usd
       FROM exchange_rates
       ORDER BY effective_date DESC`
    )
    .all();

  function rateFor(dateStr) {
    for (const r of rates) {
      if (r.effective_date <= dateStr) return r.rate_iqd_per_usd;
    }
    return null;
  }

  return txns.map((tx) => {
    const date = String(tx.created_at).slice(0, 10);
    const rate = rateFor(date);
    return {
      ...tx,
      rate_used: rate,
      amount_iqd: rate != null ? Math.round((tx.amount_usd_cents / 100) * rate) : null,
    };
  });
}

// Same logic as attachIqdFields but for a single row (one rate query).
export function attachIqdFieldsOne(tx) {
  if (!tx) return tx;
  const date = String(tx.created_at).slice(0, 10);
  const r = db
    .prepare(
      `SELECT rate_iqd_per_usd
       FROM exchange_rates
       WHERE effective_date <= ?
       ORDER BY effective_date DESC
       LIMIT 1`
    )
    .get(date);
  const rate = r?.rate_iqd_per_usd ?? null;
  return {
    ...tx,
    rate_used: rate,
    amount_iqd: rate != null ? Math.round((tx.amount_usd_cents / 100) * rate) : null,
  };
}
