# ImpactStream Backend API

A backend API for streaming your favorite movies, TV shows, and anime using The Movie Database (TMDB) and multiple streaming providers.

## Features
- Search for movies, TV shows, and anime using the TMDB API
- Get detailed info for movies and TV shows
- Get streaming embed links from multiple providers

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- TMDB API key ([Get one here](https://developer.themoviedb.org/docs/getting-started))

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/LaganYT/ImpactStream.git
   cd ImpactStream
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root directory and add your TMDB API key:
   ```env
   TMDB_API_KEY=your_tmdb_api_key
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## API Endpoints

### Search
- `GET /api/search?query=...`
  - Search for movies, TV shows, or anime by query string.

### Movie Details
- `GET /api/movie/:id`
  - Get details for a movie by TMDB ID.

### TV Show Details
- `GET /api/tv/:id`
  - Get details for a TV show by TMDB ID.

### Streaming Links
- `GET /api/stream/:type/:id`
  - Get streaming embed links for a movie or TV show from multiple providers.
  - `type` is either `movie` or `tv`.

## Example Usage

- Search:
  ```bash
  curl 'http://localhost:3000/api/search?query=Inception'
  ```
- Movie details:
  ```bash
  curl 'http://localhost:3000/api/movie/27205'
  ```
- TV details:
  ```bash
  curl 'http://localhost:3000/api/tv/1399'
  ```
- Streaming links:
  ```bash
  curl 'http://localhost:3000/api/stream/movie/27205'
  ```

## Technologies Used
- [Express](https://expressjs.com/) - Web framework for Node.js
- [Axios](https://axios-http.com/) - HTTP client for API requests
- [TMDB API](https://developer.themoviedb.org/) - Movie and TV data

## License
MIT