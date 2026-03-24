# 🎵 Adagio - Intelligent Music Discovery

Adagio is a locally-hosted desktop application combining the power of local AI (Ollama) with global music APIs (Spotify, YouTube, Genius, ACRCloud) to create an intuitive, mood-based music discovery and recognition platform.

![Adagio UI Overview](docs/AdagioThesis_Manual.md) <!-- Refer to docs for screenshots if available -->

## 🚀 Features
- **Intelligent Search**: Use natural language to search for music and receive 8 curated, massive global hits.
- **AI Anti-Hallucination Guard**: All AI song recommendations are rigorously fact-checked against the official **Spotify Developer API** before being displayed to ensure 100% accuracy.
- **Mood Analysis**: Generate a palette of dark UI colors and a mood string from song lyrics or titles using AI.
- **Audio Recognition**: Upload an MP3 or use your microphone to identify playing music via AudD and ACRCloud APIs (like Shazam).
- **Official Music Videos**: Seamlessly stream Official Music Videos exclusively via the YouTube Data API v3 (or the fallback headless scraper).
- **Deep Lyrics**: AI-generated music critic insights summarizing the deeper meaning behind a song's lyrics.

---

## 🛠️ Prerequisites
To run Adagio, you need the following installed on your machine:
* **Node.js** (v16+ recommended)
* **FFmpeg** (Included via `ffmpeg-static`, but system-wide installation is recommended for advanced audio trimming)
* **Ollama** installed locally with the `qwen2.5:0.5b` model pulled.
    * Run: `ollama run qwen2.5:0.5b` in your terminal to initialize it.

---

## 🔑 API Key Setup (secret.env)
Adagio uses several third-party APIs for music metadata, video streaming, and lyrics. Create a `secret.env` file in the root directory and add your keys:

```env
# Spotify (CRITICAL for AI Hallucination Guard)
SPOTIFY_CLIENT_ID=your_spotify_id
SPOTIFY_CLIENT_SECRET=your_spotify_secret

# YouTube (For streaming official MVs. Without this, it falls back to a headless scraper)
YOUTUBE_API_KEY=your_youtube_api_key

# Genius (For fetching song lyrics)
GENIUS_API_KEY=your_genius_key

# AudD / ACRCloud (For Audio Fingerprinting/Recognition)
AUDD_API_KEY=your_audd_api_key
ACR_ACCESS_KEY=your_acr_key
ACR_ACCESS_SECRET=your_acr_secret
ACR_HOST=identify-ap-southeast-1.acrcloud.com

# Authentication (Required for server startup)
JWT_SECRET=your_super_secret_string
```

---

## 💻 Installation & Running

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Start the Applicaton:**
   ```bash
   npm start
   ```
   *This will launch the local Express backend on `http://localhost:3000` and automatically open the Electron desktop app interface.*

---

## 📂 Project Architecture

Adagio has been professionally modularized into a Model-View-Controller (MVC) style architecture to ensure maintainability and separation of concerns.

### Root Files
* `server.js` - The main Express application entry point. It simply loads environment variables and mounts the routing modules.
* `main.js` - The Electron wrapper script that launches the desktop UI window.
* `package.json` - Defines npm scripts and project dependencies.
* `secret.env` - Secure storage for API keys.

### `/src` Directory (Backend Logic)
* **`/routes/`**
  * `auth.js` - Handles user registration (`/signup`) and login (`/signin`) using hashed `bcrypt` passwords and `jsonwebtoken`.
  * `library.js` - Handles adding, removing, and fetching saved songs for the logged-in user.
  * `music.js` - The core application router. Mounts the endpoints for Intelligent Search, Recommendations, Mood Analysis, Audio Uploads, and Lyrics checking.
* **`/services/`**
  * `ai.js` - Connects to the local Ollama instance, handles model warmup, and reliably parses AI-generated JSON.
  * `spotify.js` - Fetches Spotify Access Tokens and runs the Anti-Hallucination Guard, validating AI models against the Spotify database.
  * `youtube.js` - Interfaces with the Google YouTube Data API v3. Contains a strict `scoreVideo` matching algorithm to actively reject lyric videos and covers in favor of Official Music Videos. Includes a `ytsr` scraper fallback.
  * `recognition.js` - Handles uploading audio files, slicing them with `fluent-ffmpeg`, and routing them to AudD and ACRCloud for acoustic fingerprinting.
  * `lyrics.js` - Connects to the Genius API, searches for the correct track, and actively scrapes the HTML DOM for the song's lyric text.
* **`/utils/`**
  * `database.js` - Contains thread-safe helper functions to read and write state to the local `data/users.json` file.

### `/Public` Directory (Frontend)
Contains the HTML, CSS, and vanilla JavaScript that powers the user interface of the application.

### `/docs` Directory (Documentation)
Contains legacy design documents and LM Studio setup guides.
