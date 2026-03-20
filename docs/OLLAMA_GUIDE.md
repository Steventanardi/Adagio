# Setting Up Local LLM with Ollama

AdagioThesis is configured to use a local Large Language Model (LLM) running via **Ollama** for its AI features (Intelligent Search, Mix Generation, Lyrics Translation). This ensures maximum privacy, fast responses, and runs entirely offline without expensive API costs.

## Prerequisites

- **Ollama** installed on your system.

## Step-by-Step Setup

### 1. Install Ollama
Download and install the correct version for your operating system from the official website: [https://ollama.com/](https://ollama.com/)

### 2. Download the Qwen Model
AdagioThesis is heavily optimized to use the **Qwen** model family. Open your terminal or PowerShell and run the following command to download the model into Ollama:
```bash
ollama pull qwen3
```
*(If Qwen3 is unavailable or too heavy for your machine, you can use `ollama pull qwen2.5` or even smaller variants like `ollama pull qwen2.5:0.5b` for maximum speed).*

### 3. Ensure API Accessibility
By default, Ollama acts as a background service and automatically runs an API server locally. 
Ollama binds to `http://localhost:11434`.

### 4. Configure AdagioThesis (.env)
Make sure your `.env` file in the AdagioThesis root directory correctly points to Ollama's local URL endpoint:
```env
LOCAL_LLM_URL=http://localhost:11434/api
```

### 5. Run AdagioThesis
Start the Node server normally:
```bash
npm start
```
The application will connect to Ollama automatically!

## Troubleshooting

- **"Connection Refused" or AI Failing**: Ensure Ollama is actually running in the background. On Windows, you should see the cute little llama icon in your system tray (bottom right).
- **Slow Responses**: If your hardware (CPU/RAM) is struggling, consider pulling a smaller quantized version of the model, e.g., `ollama pull qwen2.5:1.8b`.
