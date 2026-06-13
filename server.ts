import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// High limit for base64 file uploads (PDF & images)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// -------------------------------------------------------------
// PWA Support & PWABuilder Integration Endpoints
// -------------------------------------------------------------

// Serve manifest.json with broad CORS and correct content-type
app.get("/manifest.json", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
  
  const manifestPath = process.env.NODE_ENV === "production"
    ? path.join(process.cwd(), "dist", "manifest.json")
    : path.join(process.cwd(), "public", "manifest.json");
    
  res.sendFile(manifestPath, (err) => {
    if (err) {
      // Inline Fallback Manifest if file fetch fails
      res.json({
        "id": "/?source=pwa",
        "name": "Carnet de Terrain - Botanique & Géodynamique",
        "short_name": "CarnetTerrain",
        "description": "Application académique de révision en botanique et géodynamique externe.",
        "lang": "fr",
        "dir": "ltr",
        "start_url": "/?source=pwa",
        "scope": "/",
        "display": "standalone",
        "background_color": "#faf7f0",
        "theme_color": "#405144",
        "orientation": "portrait-primary",
        "icons": [
          {
            "src": "/icon-192.png",
            "sizes": "192x192",
            "type": "image/png",
            "purpose": "any"
          },
          {
            "src": "/icon-512.png",
            "sizes": "512x512",
            "type": "image/png",
            "purpose": "any"
          },
          {
            "src": "/icon-512.png",
            "sizes": "512x512",
            "type": "image/png",
            "purpose": "maskable"
          }
        ]
      });
    }
  });
});

// Serve sw.js with broad CORS and correct javascript content-type
app.get("/sw.js", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  
  const swPath = process.env.NODE_ENV === "production"
    ? path.join(process.cwd(), "dist", "sw.js")
    : path.join(process.cwd(), "public", "sw.js");
    
  res.sendFile(swPath, (err) => {
    if (err) {
      // Fallback service worker code if sw.js reading fails
      res.send(`
        const CACHE_NAME = "carnet-terrain-v1";
        self.addEventListener("install", (e) => self.skipWaiting());
        self.addEventListener("activate", (e) => self.clients.claim());
        self.addEventListener("fetch", (e) => {
          if (e.request.method === "GET" && e.request.url.startsWith(self.location.origin)) {
            e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
          }
        });
      `);
    }
  });
});

// Dynamic PNG icons generated to avoid SVG-only limitations in Android APK wrappers
const TINY_GREEN_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

app.get("/icon-192.png", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const filePath = process.env.NODE_ENV === "production"
    ? path.join(process.cwd(), "dist", "icon-192.png")
    : path.join(process.cwd(), "public", "icon-192.png");
  res.sendFile(filePath, (err) => {
    if (err) {
      res.setHeader("Content-Type", "image/png");
      res.send(TINY_GREEN_PNG);
    }
  });
});

app.get("/icon-512.png", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const filePath = process.env.NODE_ENV === "production"
    ? path.join(process.cwd(), "dist", "icon-512.png")
    : path.join(process.cwd(), "public", "icon-512.png");
  res.sendFile(filePath, (err) => {
    if (err) {
      res.setHeader("Content-Type", "image/png");
      res.send(TINY_GREEN_PNG);
    }
  });
});

app.get("/icon-maskable.png", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const filePath = process.env.NODE_ENV === "production"
    ? path.join(process.cwd(), "dist", "icon-maskable.png")
    : path.join(process.cwd(), "public", "icon-maskable.png");
  res.sendFile(filePath, (err) => {
    if (err) {
      res.setHeader("Content-Type", "image/png");
      res.send(TINY_GREEN_PNG);
    }
  });
});

// Retrieve the GEMINI_API_KEY from environment variables
const apiKey = process.env.GEMINI_API_KEY;

// Create the GoogleGenAI client with correct headers
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Helper to construct system instruction and make safe GenAI calls
async function callGemini(promptParts: any[], systemInstruction: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptParts,
      config: {
        systemInstruction,
        temperature: 0.7,
        responseMimeType: "application/json",
      }
    });
    
    const textOutput = response.text || "{}";
    return JSON.parse(textOutput);
  } catch (err: any) {
    console.error("Gemini call failed:", err);
    return {
      error: true,
      message: err.message || "Une erreur est survenue lors de l'appel au modèle d'intelligence artificielle.",
      text: "Erreur d'appel à l'IA.",
    };
  }
}

// -------------------------------------------------------------
// Endpoint 01 & 04: Document Analysis & Active Revision
// -------------------------------------------------------------
app.post("/api/chat-document", async (req, res) => {
  const { messages, files, toolType, difficulty } = req.body;
  
  // Format prior messages
  let chatHistoryText = "";
  if (messages && messages.length > 0) {
    chatHistoryText = "Historique de discussion:\n" + messages.map((m: any) => `${m.role === 'user' ? 'Étudiant' : 'Tuteur'}: ${m.text}`).join("\n");
  }

  // Set up details for active revision vs standard document
  const isActiveRevision = toolType === "04_revision_active";
  
  const systemInstruction = `Tu es un professeur de terrain et universitaire expert en Botanique et Géodynamique. Ton ton est enthousiaste, pédagogue et scientifique, comme un carnet de notes de géologue et botaniste.
Tu réponds en français d'après les documents / images / fichiers fournis par l'étudiant, ou tes propres connaissances académiques s'ils sont à court de détails.

Tu dois impérativement renvoyer un JSON valide de la structure suivante:
{
  "text": "Le texte complet de ta réponse, rédigé en Markdown avec de beaux espaces négatifs, tirets de terrain. Si des fichiers sont fournis, cite spécifiquement le nom du document (ou fiche) et si possible la page ou paragraphe.",
  "keyConcept": {
    "isKey": true | false,
    "type": "notion-clé" | "erreur fréquente" | "résumé important",
    "justification": "Justification claire d'une phrase expliquant pourquoi cette réponse est un concept d'apprentissage clé de géodynamique ou botanique."
  }
}
Note: Si tu estimes que la réponse ne contient pas de notion critique méritant d'être apprise par cœur ou cataloguée, "keyConcept" peut être null ou avoir isKey: false.

Règles spécifiques d'outils:
${isActiveRevision 
  ? `Outil Révision active: À la toute fin du champ 'text' (après ta réponse principale), tu dois AUTOMATIQUEMENT poser une question de compréhension pertinente sur le sujet révisé, introduite exactement par : "🌱 Question pour toi : [Ta question ici]". Adapte la difficulté à l'étudiant (niveau demandé: ${difficulty || 'moyen'}).`
  : `Outil Document: S'il y a plusieurs documents ou fiches, tu DOIS commencer ou mentionner explicitement au début du champ 'text' dans quel document exact (leur nom de fichier) et si possible quelle page/section se trouve la réponse pour aider l'étudiant.`
}`;

  // Build content parts
  const promptParts: any[] = [];
  
  // 1. Add files content/base64
  if (files && files.length > 0) {
    promptParts.push({ text: "Fichiers académiques de référence fournis par l'étudiant pour cette session:" });
    files.forEach((file: any) => {
      if (file.base64) {
        promptParts.push({
          inlineData: {
            mimeType: file.mimeType,
            data: file.base64
          }
        });
        promptParts.push({ text: `Ci-dessus se trouve le fichier nommé "${file.name}" (Format: ${file.mimeType}).` });
      } else if (file.textContent) {
        promptParts.push({ text: `Fichier texte "${file.name}":\n\n${file.textContent}` });
      }
    });
  }

  // 2. Add full chat history and instructions
  promptParts.push({ text: chatHistoryText });
  
  // 3. Add latest question
  const lastUserMsg = messages && messages.length > 0 ? messages[messages.length - 1].text : "Bonjour ! Peux-tu analyser les documents fournis ?";
  promptParts.push({ text: `Dernier message de l'étudiant: "${lastUserMsg}".\nRéponds maintenant selon les règles définies en retournant UNIQUEMENT le schema JSON demandé.` });

  const result = await callGemini(promptParts, systemInstruction);
  res.json(result);
});

// -------------------------------------------------------------
// Endpoint 02: Question libre (Botany & Geodynamics expert)
// -------------------------------------------------------------
app.post("/api/chat-free", async (req, res) => {
  const { messages, subject } = req.body;

  let chatHistoryText = "";
  if (messages && messages.length > 0) {
    chatHistoryText = "Historique de la conversation:\n" + messages.map((m: any) => `${m.role === 'user' ? 'Étudiant' : 'IA'}: ${m.text}`).join("\n");
  }

  const systemInstruction = `Tu es une IA experte et passionnée de terrain, spécialiste en Botanique & Géodynamique (matière principale actuelle : ${subject || 'Mixte'}).
Ton carnet s'adresse à des étudiants préparant des révisions poussées.

Tu dois impérativement répondre en JSON avec cette structure précise:
{
  "text": "La réponse principale rédigée en français avec style Markdown très propre (puces, gras, italiques, sauts de paragraphe).",
  "suggestions": [
    "Une suggestion courte de recherche à faire sur le terrain ou en labo en rapport direct avec la question (max 10 mots)",
    "Deuxième suggestion courte..."
  ],
  "youtubeLinks": [
    {
      "title": "Titre exact de la vidéo éducative YouTube (ex: C'est pas sorcier - Les Volcans, etc.)",
      "url": "URL YouTube valide vers un contenu éducatif pertinent par exemple https://www.youtube.com/watch?v=XXXXXX ou https://www.youtube.com/results?search_query=..."
    }
  ],
  "keyConcept": {
    "isKey": true | false,
    "type": "notion-clé" | "erreur fréquente" | "résumé important",
    "justification": "Justification courte en une phrase de son importance."
  }
}
Assure-toi de fournir 1 à 3 liens YouTube éducatifs réalistes qui permettent de visualiser l'aléa géologique ou l'anatomie florale (niveaux réels recherchés!). Suggère également des axes d'observations pratiques de botanique ou de géodynamique (ex: tectonique des plaques, sédimentologie, classification phylogénétique).`;

  const lastUserMsg = messages && messages.length > 0 ? messages[messages.length - 1].text : "Présente-toi brièvement et propose des sujets d'études.";
  const promptParts = [
    { text: chatHistoryText },
    { text: `Dernière question de l'élève: "${lastUserMsg}"` }
  ];

  const result = await callGemini(promptParts, systemInstruction);
  res.json(result);
});

// -------------------------------------------------------------
// Endpoint 03: Mode Examen (Quiz Loop)
// -------------------------------------------------------------
app.post("/api/quiz", async (req, res) => {
  const { action, subject, format, difficulty, topic, history, currentQuestion, userAnswer } = req.body;

  if (action === "generate") {
    let quizHistoryText = "";
    if (history && history.length > 0) {
      quizHistoryText = "Questions déjà posées dans cette session pour éviter les doublons:\n" + 
        history.map((h: any) => `- Question: ${h.question} (Réussi: ${h.isCorrect ? 'Oui' : 'Non'})`).join("\n");
    }

    const systemInstruction = `Tu es un examinateur académique rigoureux pour les fiches de Botanique et Géodynamique.
Ton but est de générer une question de révision de haute qualité en français.

Matière: ${subject}
Format demandé: ${format} (peut être 'QCM', 'ouvert' ou 'mixte')
Difficulté: ${difficulty} (si 'progressive', adapte par rapport aux échecs/réussites de l'historique fournis)
Sujet précis optionnel s'il y a lieu: ${topic || 'Général'}

Tu dois renvoyer obligatoirement la structure JSON suivante:
{
  "question": "Texte de la question bien précis, scientifique, axé botanique ou géodynamique.",
  "options": [
    "A) Option A",
    "B) Option B",
    "C) Option C",
    "D) Option D"
  ],
  "correctAnswer": "A" | "B" | "C" | "D" | "Le texte de la bonne réponse pour une question ouverte"
}
Note importante: Si le format sélectionné est 'ouvert', le tableau 'options' doit être absolument vide ([]) et 'correctAnswer' décrira les mots-clés essentiels attendus pour valider la réponse. Si le format est 'QCM', 'options' doit contenir exactement 4 propositions de réponses commençant par 'A)', 'B)', 'C)', 'D)' et 'correctAnswer' doit être la lettre majuscule (ex: 'B'). Si le format est 'mixte', choisis aléatoirement entre QCM et ouvert.`;

    const promptParts = [
      { text: quizHistoryText },
      { text: "Génère maintenant une question révision stimulante inédite." }
    ];

    const result = await callGemini(promptParts, systemInstruction);
    res.json(result);

  } else if (action === "evaluate") {
    
    const systemInstruction = `Tu es l'évaluateur du quiz. Tu dois analyser la réponse de l'étudiant à la question posée et déterminer si elle est scientifiquement exacte.
Sois indulgent mais ferme sur les termes géologiques et botaniques nécessaires (ex: différence monocotylédones/dicotylédones ou subduction/obduction).

Tu dois renvoyer obligatoirement la structure JSON suivante:
{
  "isCorrect": true | false,
  "explanation": "Une explication pédagogique détaillée qui justifie la réponse et rappelle le cours correspondants.",
  "correctAnswer": "Rappel clair de la bonne réponse ou des mots-clés indispensables.",
  "keyConcept": {
    "isKey": true | false,
    "type": "notion-clé" | "erreur fréquente" | "résumé important",
    "justification": "Justification de l'importance de ce point en géodynamique ou botanique de terrain."
  }
}
Détecte si l'erreur de l'étudiant représente une "erreur fréquente" (ex: confondre sills et dykes) pour l'enregistrer dans notre mémoire.`;

    const promptParts = [
      { text: `Sujet du quiz: ${subject}` },
      { text: `Question posée: "${currentQuestion}"` },
      { text: `Réponse de l'étudiant: "${userAnswer}"` },
      { text: `Réponse ou mots-clés attendus initialement: "${req.body.correctAnswer || ''}"` },
      { text: "Évalue sa réponse de manière pédagogique et retourne le JSON demandé." }
    ];

    const result = await callGemini(promptParts, systemInstruction);
    res.json(result);
  }
});

// -------------------------------------------------------------
// Vite and Static File Middleware
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static frontend from dist directory
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
