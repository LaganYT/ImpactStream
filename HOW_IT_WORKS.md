# How ImpactStream Backend API Works

## Overview
ImpactStream Backend API is a Node.js/Express server written in TypeScript. It provides endpoints to search for movies, TV shows, and anime, fetch detailed information, and generate streaming embed links using The Movie Database (TMDB) and multiple streaming providers.

## Architecture
- **Express.js**: Handles HTTP requests and routing.
- **TypeScript**: Ensures type safety and maintainability.
- **Axios**: Used for making HTTP requests to external APIs (TMDB, streaming providers).
- **dotenv**: Loads environment variables (e.g., TMDB API key).

### Directory Structure
```
/ImpactStream
  /src
    /routes      # Express route handlers for API endpoints
    /services    # Logic for interacting with TMDB and streaming providers
    index.ts     # Main server entry point
  package.json   # Project dependencies and scripts
  tsconfig.json  # TypeScript configuration
  .env           # Environment variables (not committed)
```

## API Flow
### 1. Search Endpoint (`/api/search`)
- Accepts a `query` parameter.
- Calls TMDB's `/search/multi` endpoint to search for movies, TV shows, and people.
- Returns the raw TMDB search results.

### 2. Movie Details (`/api/movie/:id`)
- Accepts a TMDB movie ID as a URL parameter.
- Calls TMDB's `/movie/{id}` endpoint to fetch detailed info.
- Returns the movie details from TMDB.

### 3. TV Show Details (`/api/tv/:id`)
- Accepts a TMDB TV show ID as a URL parameter.
- Calls TMDB's `/tv/{id}` endpoint to fetch detailed info.
- Returns the TV show details from TMDB.

### 4. Streaming Links (`/api/stream/:type/:id`)
- Accepts a `type` (`movie` or `tv`) and a TMDB ID.
- Generates a list of embed URLs for various streaming providers, using the ID and type.
- Returns an array of objects: `{ provider, embedUrl }`.
- Note: The actual streaming is handled by the third-party providers; this API only generates embed links.

## Integration Details
### TMDB API
- Requires a TMDB API key (set in `.env` as `TMDB_API_KEY`).
- All requests to TMDB are made server-side using Axios.

### Streaming Providers
- The API does not host or proxy any video content.
- It generates embed URLs for known providers (e.g., VidSrc, VidLink, AutoEmbed, etc.).
- The embed URLs are constructed based on provider patterns and the TMDB ID.

## Error Handling
- If TMDB or a provider is unreachable, the API returns a 500 error with a relevant message.
- If required parameters are missing, the API returns a 400 error.

## Security & Limitations
- The API key is kept server-side and never exposed to clients.
- The API does not cache or store any data; all results are fetched live.
- Streaming links are only as reliable as the third-party providers.

## Extending the API
- Add new providers by updating `src/services/stream.ts`.
- Add new endpoints by creating new route files in `src/routes/` and corresponding logic in `src/services/`.

## Example Request Flow
1. **Client** sends a search request: `GET /api/search?query=Naruto`.
2. **Server** calls TMDB, returns search results.
3. **Client** requests details: `GET /api/movie/12345`.
4. **Server** fetches and returns movie details from TMDB.
5. **Client** requests streaming links: `GET /api/stream/movie/12345`.
6. **Server** generates and returns embed URLs for all providers.

---
For more, see the main `README.md` for setup and endpoint documentation. 