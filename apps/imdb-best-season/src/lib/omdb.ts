export const OMDB_BASE_URL = "https://www.omdbapi.com";

export async function fetchFromOMDB(params: string): Promise<Response> {
  const apiKey = process.env.OMDB_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OMDB API key not configured. Get your free key at https://www.omdbapi.com/apikey.aspx"
    );
  }
  return fetch(`${OMDB_BASE_URL}/?${params}&apikey=${apiKey}`);
}
