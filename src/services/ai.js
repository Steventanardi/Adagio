const fetch = require('node-fetch');

const OLLAMA_MODEL   = 'qwen2.5:0.5b';
const OLLAMA_URL     = 'http://localhost:11434/api/chat';
const OLLAMA_TIMEOUT = 90_000;

function parseAIResponse(text) {
    try {
        const jsonStartIndex = text.indexOf('{');
        const arrayStartIndex = text.indexOf('[');
        let startIndex = -1;
        if (jsonStartIndex !== -1 && (arrayStartIndex === -1 || jsonStartIndex < arrayStartIndex)) {
            startIndex = jsonStartIndex;
        } else {
            startIndex = arrayStartIndex;
        }
        if (startIndex !== -1) {
            const lastChar = text.charAt(startIndex) === '{' ? '}' : ']';
            const endIndex = text.lastIndexOf(lastChar);
            if (endIndex !== -1) {
                const jsonStr = text.substring(startIndex, endIndex + 1);
                return JSON.parse(jsonStr);
            }
        }
    } catch (e) {
        console.error('Failed to parse AI response:', e);
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
                model: OLLAMA_MODEL,
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
    console.log(`🔥 Warming up Ollama model (${OLLAMA_MODEL})...`);
    try {
        await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
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

module.exports = {
    parseAIResponse,
    callAI,
    warmupModel
};
