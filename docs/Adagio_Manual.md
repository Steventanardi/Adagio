# 🎓 Adagio: Installation & Demonstration Guide

Welcome to **Adagio**, an AI-powered music recognition and exploration platform. This guide provides instructions for setting up the environment and demonstrating the core features.

---

## 🛠️ Prerequisites

Before you begin, ensure you have the following installed:
1.  **Node.js** (v18 or higher)
2.  **MySQL Server**
3.  **Local LLM Runner**: [Ollama](https://ollama.com/)
4.  **FFmpeg** (Included in dev dependencies, but system-wide installation is recommended for performance)

---

## 🚀 Setup Instructions

### 1. Database Setup
1.  Start your MySQL server.
2.  Create a database named `adagio`.
3.  (Optional) The app will use `localStorage` for some "Pro" features like favorites, but user accounts require the MySQL backend.

### 2. Local LLM Setup (Ollama & Qwen)
1.  Install **Ollama** from `ollama.com`.
2.  Open your terminal and pull your preferred Qwen model (e.g., `ollama pull qwen3` or `ollama pull qwen2.5`).
3.  Ensure the Ollama service is running in the background. It will automatically listen on `http://localhost:11434`.

### 3. Environment Variables
Create a `.env` file in the root directory and add:
```env
ACR_HOST=your_acr_host
ACR_ACCESS_KEY=your_acr_key
ACR_ACCESS_SECRET=your_acr_secret
AUDD_API_KEY=your_audd_key
SPOTIFY_CLIENT_ID=your_id
SPOTIFY_CLIENT_SECRET=your_secret
YOUTUBE_API_KEY=your_yt_key
LOCAL_LLM_URL=http://localhost:11434/api
```

### 4. Installation
```powershell
# Install dependencies
npm install

# Start the application
npm start
```

---

## 🎬 Demonstration Script

### Feature 1: Intelligent Search (AI Brain)
- **Action**: Type something vague like "songs for a rainy night in Tokyo" or "that one TikTok song about sushi".
- **Result**: The local **Qwen3 model** brainstorms relevant songs, and Adagio fetches their streaming links and lyrics instantly.

### Feature 2: Smart Mood UI
- **Action**: Click a "Mood Chip" (e.g., 🔥 Party or 🌙 Chill).
- **Result**: Witness the UI colors transform with smooth cinematic transitions. 
- **Bonus**: Click the same chip again—thanks to the **Discovery Engine**, you'll get a different set of recommendations every time!

### Feature 3: AI Mix (Playlist Generator)
- **Action**: Identify a song, then click "Create AI Mix".
- **Result**: Qwen3 analyzes the vibe and builds a mini-playlist of 5 similar tracks with direct Spotify links.

### Feature 4: 3D Neon Visualizer
- **Action**: Upload an audio file or use the Microphone.
- **Result**: A glowing, neon audio visualizer reacts in real-time to the frequency spectrum.

