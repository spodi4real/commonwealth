import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { fmtIQD, fmtRelativeDate } from '../lib/format.js';

export function PendingApprovals({ onChange }) {
  const [reqs, setReqs] = useState([]);
  const [note, setNote] = useState({});

  const load = async () => {
    const r = await api.get('/api/approvals?status=pending');
    setReqs(r.requests);
  };
  useEffect(() => {
    load().catch(() => {});
    const id = setInterval(() => load().catch(() => {}), 5000);
    return () => clearInterval(id);
  }, []);

  const decide = async (id, action) => {
    await api.post(`/api/approvals/${id}/${action}`, {
      ownerNote: note[id] || undefined,
    });
    setNote((n) => ({ ...n, [id]: '' }));
    await load();
    onChange?.();
  };

  if (reqs.length === 0) return null;

  return (
    <div className="cw-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="cw-label">Pending from Mom</div>
        <span className="text-xs text-warning">{reqs.length} waiting</span>
      </div>
      <div className="space-y-3">
        {reqs.map((r) => (
          <div key={r.id} className="border border-line rounded p-3">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="font-serif text-xl">{fmtIQD(r.amount_iqd)}</span>
                <span className="text-inkDim ml-2 text-sm">{r.category}</span>
              </div>
              <span className="text-xs text-inkDim">{fmtRelativeDate(r.created_at)}</span>
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={note[r.id] ?? ''}
                onChange={(e) => setNote((n) => ({ ...n, [r.id]: e.target.value }))}
                placeholder="Reason (optional)"
                className="cw-input flex-1 text-sm"
                maxLength={200}
              />
              <button onClick={() => decide(r.id, 'approve')}
                className="cw-btn bg-success text-bg hover:bg-success/80 text-sm px-3">
                Approve
              </button>
              <button onClick={() => decide(r.id, 'deny')}
                className="cw-btn bg-danger text-bg hover:bg-danger/80 text-sm px-3">
                Deny
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
