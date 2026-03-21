const fetch = require('node-fetch');

const OLLAMA_URL      = 'http://localhost:11434/api/chat';
const OLLAMA_TAGS_URL = 'http://localhost:11434/api/tags';
const OLLAMA_TIMEOUT  = 90_000;

const PREFERRED_MODELS = ['qwen3.5:9b', 'qwen2.5:0.5b'];
let currentModel = 'qwen2.5:0.5b'; // default fallback

function parseAIResponse(text) {
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        try {
            const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (match) return JSON.parse(match[1]);
        } catch {}

        try {
            const braceMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            if (braceMatch) return JSON.parse(braceMatch[0]);
        } catch (e) {
            console.error('Failed to parse AI response structure:', e.message);
        }
    }
    return null;
}

async function callAI(systemPrompt, userPrompt, temperature = 0.7, maxTokens = 400, label = 'AI') {
    console.log(`🤖 AI [${label}]: ${userPrompt.substring(0, 60)}...`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT);
    try {
        const response = await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                model: currentModel,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user',   content: userPrompt   }
                ],
                stream: false,
                think: false,         // native endpoint properly suppresses Qwen3 thinking
                keep_alive: -1,       // keep model in VRAM — eliminates cold-start
                options: {
                    temperature,
                    num_ctx: 2048,    // small context window = faster first-token
                    num_predict: maxTokens
                }
            })
        });
        clearTimeout(timer);
        if (response.ok) {
            const data = await response.json();
            const text = data.message?.content?.trim(); // native /api/chat response shape
            if (text) { console.log(`✅ Ollama done [${label}]`); return text; }
            throw new Error('Empty response from model');
        }
        throw new Error(`Ollama HTTP ${response.status}`);
    } catch (e) {
        clearTimeout(timer);
        const msg = e.name === 'AbortError' ? 'Ollama timed out (90s)' : e.message;
        console.error(`❌ AI failed: ${msg}`);
        throw new Error(`Local AI unavailable: ${msg}. Is Ollama running?`);
    }
}

async function warmupModel() {
    await selectBestModel();
    console.log(`🔥 Warming up Ollama model (${currentModel})...`);
    try {
        await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: currentModel,
                messages: [{ role: 'user', content: 'hi' }],
                stream: false,
                think: false,
                keep_alive: -1,
                options: { num_ctx: 512, num_predict: 1 }
            })
        });
        console.log(`✅ Ollama model is warm and ready!`);
    } catch (e) {
        console.warn(`⚠️ Warmup failed — is Ollama running? (${e.message})`);
    }
}

async function selectBestModel() {
    try {
        const response = await fetch(OLLAMA_TAGS_URL);
        if (!response.ok) throw new Error(`Ollama Tags API error: ${response.status}`);
        const data = await response.json();
        const availableModels = data.models.map(m => m.name);
        
        for (const preferred of PREFERRED_MODELS) {
            if (availableModels.includes(preferred)) {
                currentModel = preferred;
                console.log(`🎯 Selected model: ${currentModel}`);
                return;
            }
        }
        console.warn(`⚠️ None of preferred models found. Staying with default: ${currentModel}`);
    } catch (e) {
        console.error(`❌ Failed to list Ollama models: ${e.message}. Using default: ${currentModel}`);
    }
}

module.exports = {
    parseAIResponse,
    callAI,
    warmupModel
};
