# Setting Up Local LLM with LM Studio

Adagio is configured to use a local Large Language Model (LLM) running via **LM Studio** for its AI features (Intelligent Search, Lyrics Translation, etc.). This ensures privacy and runs offline without API costs.

## Prerequisites

- A computer with a decent GPU is recommended (though it can run on CPU, it will be slower).
- **LM Studio** installed.

## Step-by-Step Setup

### 1. Install LM Studio
Download and install LM Studio from the official website: [https://lmstudio.ai/](https://lmstudio.ai/)

### 2. Download a Model
1.  Open **LM Studio**.
2.  Click the **Search** (magnifying glass) icon on the left sidebar.
3.  Search for `Qwen 3 8B` (or `Qwen 2.5 8B` depending on availability. The app is tested with Qwen-based models).
    - We recommend `Qwen/Qwen2.5-7B-Instruct-GGUF` or `Qwen/Qwen2.5-Coder-7B-Instruct-GGUF` if 8B is not specifically listed, but the user setup uses **Qwen3 8B**.
    - Look for a quantization level like `Q4_K_M` (good balance of speed and quality).
4.  Click **Download**.

### 3. Load the Model
1.  Go to the **AI Chat** (bubble icon) or **Local Server** (double arrow icon `<->`) tab on the left.
2.  At the top, select the model you just downloaded from the dropdown menu.
3.  Wait for the green bar to load at the top.

### 4. Start the Local Server
1.  Click the **Local Server** icon (`<->`) on the left if you aren't there already.
2.  On the right side panel, ensure the settings are:
    - **Port**: `1234` (Default)
    - **Cross-Origin-Resource-Sharing (CORS)**: ON (Enabled)
3.  Click the **Start Server** button.
4.  You should see logs appearing in the bottom console indicating the server is listening on `http://localhost:1234`.

### 5. Run Adagio
Does not require any extra configuration. Just run:

```bash
npm start
```

The application will automatically connect to your local LM Studio instance at `http://localhost:1234/v1`.

## Troubleshooting

-   **"Connection Refused"**: Ensure the server is actually started in LM Studio and the port is 1234.
-   **"Model not loaded"**: Make sure you selected a model in the top dropdown in LM Studio.
-   **Slow Responses**: Try a smaller model (e.g., Qwen 1.5 4B or 1.8B) or a higher quantization (Q4_K_S) if your hardware is struggling.
