const BACKEND = "http://localhost:3000";

async function askBackend(query) {
  const res = await fetch(`${BACKEND}/ask`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ query })
  });

  return await res.json();
}

async function saveToBackend(entry) {
  const res = await fetch(`${BACKEND}/add`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(entry)
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.ok === false) {
    throw new Error(data.error || "Unable to save this service right now.");
  }

  return data;
}
