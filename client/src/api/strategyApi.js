async function parseJson(res) {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export function createStrategyApi(base) {
  return {
    fetchStrategies() {
      return fetch(`${base}/strategies`).then(parseJson);
    },
    createStrategy(payload) {
      return fetch(`${base}/strategies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(parseJson);
    },
    updateStrategy(id, payload) {
      return fetch(`${base}/strategies/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(parseJson);
    },
    deleteStrategy(id) {
      return fetch(`${base}/strategies/${id}`, { method: 'DELETE' }).then(parseJson);
    },
    activateStrategy(id) {
      return fetch(`${base}/strategies/${id}/activate`, { method: 'POST' }).then(
        parseJson
      );
    },
  };
}
