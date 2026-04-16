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
  await fetch(`${BACKEND}/add`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(entry)
  });
}