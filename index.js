import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const app = express();
const upload = multer();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const GEMINI_MODEL = "gemini-2.5-flash";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server ready on http://localhost:${PORT}`));

app.post("/generate-text", async (req, res) => {
    const { prompt } = req.body;
    
    try {
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents : prompt,
        });

        res.status(200).json({ result: response.text });
    } catch (e) {
        console.log(e);
        res.status(500).json({ message: e.message });
    }
});

app.post("/generate-image", upload.single("image"), async (req, res) => {
    const { prompt } = req.body;
    const base64Image = req.file.buffer.toString("base64");

    try {
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents : [
                { text: prompt, type: "text" },
                { inlineData: { data: base64Image, mimeType: req.file.mimetype } }
            ],
        });

        res.status(200).json({ result: response.text });
    } catch (e) {
        console.log(e);
        res.status(500).json({ message: e.message });
    }
});

app.post("/generate-from-document", upload.single("document"), async (req, res) => {
    const { prompt } = req.body;
    const base64Document = req.file.buffer.toString("base64");

    try {
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents : [
                { text: prompt ?? "Tolong buat ringkasan dari dokumen berikut.", type: "text" },
                { inlineData: { data: base64Document, mimeType: req.file.mimetype } }
            ],
        });

        res.status(200).json({ result: response.text });
    } catch (e) {
        console.log(e);
        res.status(500).json({ message: e.message });
    }
});

app.post("/generate-from-audio", upload.single("audio"), async (req, res) => {
    const { prompt } = req.body;
    const base64Audio = req.file.buffer.toString("base64");

    try {
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents : [
                { text: prompt ?? "Tolong buat transkrip dari rekaman berikut.", type: "text" },
                { inlineData: { data: base64Audio, mimeType: req.file.mimetype } }
            ],
        });

        res.status(200).json({ result: response.text });
    } catch (e) {
        console.log(e);
        res.status(500).json({ message: e.message });
    }
});

app.post('/api/chat', async (req, res) => {
    const { conversation, options = {} } = req.body;

    try {
        if (!Array.isArray(conversation)) throw new Error("Conversation must be an array of messages.");

        const normalizeText = (value, maxLen) => {
            if (typeof value !== 'string') return '';
            return value.trim().slice(0, maxLen);
        };

        const style = normalizeText(options.style, 60) || 'ramah dan jelas';
        const domain = normalizeText(options.domain, 80) || 'umum';
        const useCase = normalizeText(options.useCase, 80) || 'assistant serbaguna';
        const includeRecommendations = Boolean(options.includeRecommendations);
        const useMemory = options.useMemory !== false;
        const temperatureValue = Number(options.temperature);
        const temperature = Number.isFinite(temperatureValue)
            ? Math.min(Math.max(temperatureValue, 0.1), 1.2)
            : 0.7;

        const systemInstruction = [
            'Jawab hanya menggunakan bahasa Indonesia.',
            `Gaya bahasa: ${style}.`,
            `Use case: ${useCase}.`,
            domain !== 'umum' ? `Fokus pengetahuan: ${domain}.` : null,
            includeRecommendations
                ? 'Setelah jawaban, berikan 2-3 rekomendasi tindak lanjut dalam poin singkat.'
                : null,
            'Jika pertanyaan kurang jelas, ajukan pertanyaan klarifikasi singkat.',
        ].filter(Boolean).join(' ');

        const normalizedConversation = conversation
            .filter((item) => item && typeof item.text === 'string')
            .map(({ role, text }) => ({
                role: role === 'model' ? 'model' : 'user',
                parts: [{ text: text.trim() }],
            }));

        if (normalizedConversation.length === 0) {
            throw new Error("Conversation tidak boleh kosong.");
        }

        const lastUserMessage = [...normalizedConversation]
            .reverse()
            .find((item) => item.role === 'user');

        const contents = useMemory
            ? normalizedConversation
            : (lastUserMessage ? [lastUserMessage] : normalizedConversation.slice(-1));

        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents,
            config: {
                temperature,
                systemInstruction,
            },
        });

        res.status(200).json({ result: response.text });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});