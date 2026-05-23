async function request(path, opts = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
    ...opts,
    body: opts.body !== undefined && typeof opts.body !== 'string'
      ? JSON.stringify(opts.body)
      : opts.body,
  });
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const err = new Error(data?.error || `request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function safeJson(text) {
  try { return JSON.parse(text); } catch { return text; }
}

export const api = {
  get:  (p)        => request(p, { method: 'GET' }),
  post: (p, body)  => request(p, { method: 'POST', body }),
  put:  (p, body)  => request(p, { method: 'PUT',  body }),
  del:  (p)        => request(p, { method: 'DELETE' }),
};
