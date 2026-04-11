type HfJsonRequest = {
  endpoint: string;
  token?: string;
  body: unknown;
};

export async function postHfJson<T>({ endpoint, token, body }: HfJsonRequest): Promise<T> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`HF segmentation request failed with status ${response.status}.`);
  }

  return (await response.json()) as T;
}
