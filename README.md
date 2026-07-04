# ImpactStream

A way to stream your favorite movies and TV shows with the VIDEASY player.

## Features

- Search for movies, TV shows, and anime using The Movie Database (TMDB) API.
- Stream content with [VIDEASY](https://player.videasy.to).
- Movie URL format: `https://player.videasy.to/movie/{tmdbMovieId}`
- TV URL format: `https://player.videasy.to/tv/{tmdbShowId}/{season}/{episode}`
- Responsive and user-friendly interface.
- Customizable player options.

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- API key from [The Movie Database (TMDB)](https://developer.themoviedb.org/docs/getting-started)

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

3. Create a `.env.local` file in the root directory and add your TMDB API key:
   ```plaintext
   NEXT_PUBLIC_TMDB_API_KEY=your_tmdb_api_key
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:3000`.

## Usage

1. Use the search bar on the homepage to search for movies or TV shows.
2. Select a result to view details and open the embedded VIDEASY player.
3. Optionally adjust player options via URL parameters.

## Technologies Used

- [Next.js](https://nextjs.org/) - React framework for server-side rendering.
- [Axios](https://axios-http.com/) - HTTP client for API requests.
- [TMDB API](https://developer.themoviedb.org/) - For fetching movie, TV show, and anime data.

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Acknowledgments

- [TMDB](https://www.themoviedb.org/) for providing movie and TV show data.
- [VIDEASY](https://player.videasy.to) for embedded playback.