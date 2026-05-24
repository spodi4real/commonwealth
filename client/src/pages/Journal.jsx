import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { fmtDate } from '../lib/format.js';
import { AuthedShell } from '../components/Layout.jsx';
import { ReviewModal } from '../components/ReviewModal.jsx';

function previousMonthISO() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function Journal() {
  const [reviews, setReviews] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // { month, existingAnswers }

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/reviews');
      setReviews(r.reviews);
      if (r.reviews[0]?.questions) setQuestions(r.reviews[0].questions);
      else {
        const q = await api.get('/api/reviews/questions');
        setQuestions(q.questions);
      }
    } finally { setLoading(false); }
  };
  useEffect(() => { load().catch(() => {}); }, []);

  return (
    <AuthedShell>
      <div className="space-y-6">
        <header className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="cw-label">Reflection</div>
            <h1 className="text-4xl mt-1">Wealth Journal</h1>
            <p className="text-inkDim mt-2 text-sm max-w-2xl leading-relaxed">
              Five questions every month. After twelve months you have a year of
              your own thinking to read back — the part of wealth-building no
              chart can show you.
            </p>
          </div>
          <button
            onClick={() => setEditing({ month: previousMonthISO(), existingAnswers: null })}
            className="cw-btn-primary"
          >
            + Write monthly review
          </button>
        </header>

        {loading && <div className="text-inkDim">Loading…</div>}
        {!loading && reviews.length === 0 && (
          <div className="cw-card p-10 text-center text-inkDim text-sm">
            No reviews yet. Write your first one to begin the journal.
          </div>
        )}

        <div className="space-y-4">
          {reviews.map((r) => (
            <div key={r.id} className="cw-card p-5">
              <div className="flex items-baseline justify-between">
                <h2 className="font-serif text-2xl">{r.month}</h2>
                <button
                  onClick={() => setEditing({
                    month: r.month,
                    existingAnswers: { q1: r.q1, q2: r.q2, q3: r.q3, q4: r.q4, q5: r.q5 },
                  })}
                  className="cw-btn-ghost text-xs"
                >
                  Edit
                </button>
              </div>
              <div className="text-xs text-inkDim mb-3">
                written {fmtDate(r.created_at)}
              </div>
              <dl className="space-y-3 text-sm">
                {[r.q1, r.q2, r.q3, r.q4, r.q5].map((ans, i) => (
                  <div key={i}>
                    <dt className="text-inkDim text-xs italic">{questions[i]}</dt>
                    <dd className="text-ink mt-1 whitespace-pre-wrap leading-relaxed">{ans}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </div>

      {editing && (
        <ReviewModal
          month={editing.month}
          questions={questions}
          existingAnswers={editing.existingAnswers}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await load(); }}
        />
      )}
    </AuthedShell>
  );
}
