import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK with telemetry User-Agent as instructed
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

const DEFAULT_MODEL = "gemini-3.5-flash";

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

/**
 * Endpoint to initialize a topic-specific interview structure
 * Part 1: Warm up questions on selected topic
 * Part 2: Dynamic IELTS Cue Card prompt
 * Part 3: In-depth follow-up discussion questions
 */
app.post("/api/init-practice", async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic) {
      return res.status(400).json({ error: "Topic is required" });
    }

    const systemInstruction = `
      You are an expert IELTS Speaking Examiner and professional video podcast host. 
      Create standard IELTS Speaking materials (Part 1, Part 2 cue card, and Part 3) based on the user's chosen topic: "${topic}".
      Maintain a classy, professional, and friendly podcasting host tone.
      
      Generate:
      1. A set of three realistic Part 1 greeting questions on the topic.
      2. A Part 2 Cue Card task specifying a topic to describe, including 3-4 bullet points (what they should cover) and 1 minute preparation instructions.
      3. A list of three deep, abstract Part 3 discussion questions expanding on the Part 2 theme.
    `;

    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: `Please generate IELTS Speaking Part 1, 2, and 3 questions for the topic: "${topic}".`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            part1Questions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Three warm-up questions appropriate for Part 1.",
            },
            part2CueCard: {
              type: Type.OBJECT,
              properties: {
                topic: { type: Type.STRING, description: "The main Cue Card topic statement." },
                bullets: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Bullet points detailing what the candidate should include (e.g. 'explain why...', 'describe when...').",
                },
                advice: { type: Type.STRING, description: "General professional preparation tip." },
              },
              required: ["topic", "bullets", "advice"],
            },
            part3Questions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Three broader, analytical discussion questions for Part 3 based on Part 2.",
            },
          },
          required: ["part1Questions", "part2CueCard", "part3Questions"],
        },
      },
    });

    const data = JSON.parse(response.text.trim());
    return res.json(data);
  } catch (error: any) {
    console.error("Error in init-practice:", error);
    return res.status(500).json({ error: error?.message || "Failed to initiate practice materials" });
  }
});

/**
 * Live Listener Endpoint
 * Evaluates what the user has said so far in a fluid conversation context.
 * Decides if the AI should jump in as a supportive live host or ask an encouraging question.
 * Returns overlay text (no audio) to keep the flow active without stressing the student.
 */
app.post("/api/live-listen", async (req, res) => {
  try {
    const { transcript, activeQuestion, currentPart, history } = req.body;

    const systemInstruction = `
      You are an active, supportive IELTS Speaking examiner acting as a podcast co-host.
      Your goal is to gently guide the user without interrupting their voice, by providing brief, supportive, or prompting overlay text (1-2 sentences maximum).
      
      Look at the current transcript of what the user is saying right now: "${transcript || ""}"
      If the user seems stuck or silent, provide an encouraging follow-up prompt or ask them to elaborate on a specific point.
      If they seem to be talking smoothly, provide a brief active listening reaction (like "Fascinating! How did that make you feel?" or "Excellent point. Could you give an example of that?").
      Keep your response very natural, classy, and short so it can fit beautifully as overlay text on video.
      Do not sound critical or highlight errors yet; keep it highly encouraging!
    `;

    const chatContext = history && history.length > 0 
      ? JSON.stringify(history.slice(-4)) 
      : `Current question: "${activeQuestion}"`;

    const prompt = `
      User transcript so far: "${transcript}"
      Active prompt/question: "${activeQuestion}"
      This is IELTS Part ${currentPart || 1}.
      Recent interaction context: ${chatContext}
      
      Generate a short, snappy, supportive live host prompt (overlay text) to show on the user's screen. Max 20 words.
    `;

    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hostResponse: { 
              type: Type.STRING, 
              description: "A short, engaging response or follow-up question. Under 15-20 words." 
            },
            suggestNextQuestion: { 
              type: Type.BOOLEAN, 
              description: "True if the candidate seems to have fully answered the active question and it is safe to proceed to a new prompt." 
            }
          },
          required: ["hostResponse", "suggestNextQuestion"],
        },
      },
    });

    const data = JSON.parse(response.text.trim());
    return res.json(data);
  } catch (error: any) {
    console.error("Error in live-listen:", error);
    return res.status(500).json({ error: "Failed to generate interview overlay" });
  }
});

/**
 * Evaluation Endpoint
 * Assesses the user's completed practice based strictly on the official IELTS speaking criteria:
 * 1. Fluency & Coherence
 * 2. Lexical Resource
 * 3. Grammatical Range & Accuracy
 * 4. Pronunciation
 * Highly Highlights mistakes in red HTML or detailed diagnostic format.
 */
app.post("/api/evaluate-session", async (req, res) => {
  try {
    const { transcriptLog, durationSeconds, chosenTopic } = req.body;

    if (!transcriptLog) {
      return res.status(400).json({ error: "Transcription log is empty" });
    }

    const systemInstruction = `
      You are an expert IELTS Speaking Examiner and Senior ELT Evaluator.
      Analyze the candidate's speech script across standard IELTS Speaking assessment boundaries:
      - Fluency and Coherence (FC)
      - Lexical Resource (LR)
      - Grammatical Range and Accuracy (GRA)
      - Pronunciation (PR) (Evaluate speech flow, pace, pause features reflected in transcript text)
      
      CRITICAL LANGUAGE REQUIREMENT: Because the candidate is Chinese, you MUST write the following fields in simplified CHINESE (简体中文):
      - feedbackSummary (总体学术评估总结)
      - strength, weakness, suggestion for all 4 criteria metrics (各个评分标准的优势、劣势/改进空间与考官建议)
      - explanation inside the answers.errors array and inside HTML annotation data-explanation (语法错误的中文名师解析)
      
      You must:
      1. Provide realistic IELTS scores for each of the 4 areas and calculate an accurate overall score (rounded to the nearest 0.5 boundary, e.g. 5.5, 6.0, 6.5, 7.0).
      2. Carefully review the full transcript and list all major/minor grammatical and lexical errors.
      3. Create annotated HTML strings for Part 1, Part 2, and Part 3, where grammatical and styling errors are wrapped in a special red highlight span.
         - Wrap errors in this EXACT format:
           <span class="ielts-error bg-rose-50 text-rose-700 underline decoration-rose-400 font-semibold px-1 py-0.5 rounded cursor-pointer group relative inline-block transition hover:bg-rose-100" data-original="[original word]" data-correction="[recommended correction]" data-explanation="[用中文简短地释此语法或用词错误]">[original word]</span>
         - Ensure the HTML syntax is perfectly balanced. Do not break tags.
         - The remaining normal text must not have any tags.
      4. Support your diagnostics with specific IELTS-aligned suggestions (written in Chinese).
    `;

    const prompt = `
      Below is the complete transcript log representing conversational segments of this IELTS practice:
      Chosen Topic: ${chosenTopic || "General Topic"}
      Practice duration: ${durationSeconds} seconds
      
      Conversation Log:
      ${JSON.stringify(transcriptLog, null, 2)}
      
      Evaluate the user's responses. Detail positive feedback (strengths) and concrete aspects to improve (weaknesses) for all criteria. Annotate the answers with helpful red-underlined corrections.
    `;

    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallScore: { type: Type.NUMBER, description: "Calculated overall IELTS speaking score (between 1.0 and 9.0)." },
            feedbackSummary: { type: Type.STRING, description: "A high-level diagnostic executive summary." },
            fluencyAndCoherence: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                strength: { type: Type.STRING },
                weakness: { type: Type.STRING },
                suggestion: { type: Type.STRING },
              },
              required: ["score", "strength", "weakness", "suggestion"],
            },
            lexicalResource: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                strength: { type: Type.STRING },
                weakness: { type: Type.STRING },
                suggestion: { type: Type.STRING },
              },
              required: ["score", "strength", "weakness", "suggestion"],
            },
            grammaticalRangeAndAccuracy: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                strength: { type: Type.STRING },
                weakness: { type: Type.STRING },
                suggestion: { type: Type.STRING },
              },
              required: ["score", "strength", "weakness", "suggestion"],
            },
            pronunciation: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                strength: { type: Type.STRING },
                weakness: { type: Type.STRING },
                suggestion: { type: Type.STRING },
              },
              required: ["score", "strength", "weakness", "suggestion"],
            },
            answers: {
              type: Type.OBJECT,
              properties: {
                part1Text: { type: Type.STRING, description: "Raw clean transcription of Part 1 answers by the user" },
                part2Text: { type: Type.STRING, description: "Raw clean transcription of Part 2 description by the user" },
                part3Text: { type: Type.STRING, description: "Raw clean transcription of Part 3 answers by the user" },
                part1AnnotatedHtml: { type: Type.STRING, description: "HTML transcription of Part 1 with red errors <span class='ielts-error' data-original='...' data-correction='...' data-explanation='...'>...</span>" },
                part2AnnotatedHtml: { type: Type.STRING, description: "HTML transcription of Part 2 with red errors <span class='ielts-error' data-original='...' data-correction='...' data-explanation='...'>...</span>" },
                part3AnnotatedHtml: { type: Type.STRING, description: "HTML transcription of Part 3 with red errors <span class='ielts-error' data-original='...' data-correction='...' data-explanation='...'>...</span>" },
                errors: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      original: { type: Type.STRING },
                      correction: { type: Type.STRING },
                      explanation: { type: Type.STRING },
                      context: { type: Type.STRING },
                      part: { type: Type.INTEGER },
                    },
                    required: ["original", "correction", "explanation", "context", "part"],
                  },
                  description: "Flattened array of grammatical or lexical errors detected.",
                },
              },
              required: ["part1Text", "part2Text", "part3Text", "part1AnnotatedHtml", "part2AnnotatedHtml", "part3AnnotatedHtml", "errors"],
            },
          },
          required: [
            "overallScore",
            "feedbackSummary",
            "fluencyAndCoherence",
            "lexicalResource",
            "grammaticalRangeAndAccuracy",
            "pronunciation",
            "answers",
          ],
        },
      },
    });

    const data = JSON.parse(response.text.trim());
    return res.json(data);
  } catch (error: any) {
    console.error("Error in evaluate-session:", error);
    return res.status(500).json({ error: error?.message || "Failed to generate speaking diagnostic evaluation" });
  }
});

// Setup Vite Dev server middleware or static server
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[IELTS Coach Engine] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
