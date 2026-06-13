import React, { useState, useEffect, useRef } from "react";
import { 
  Plus, 
  Trash2, 
  Star, 
  ArrowRight, 
  Upload, 
  Search, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  BookOpen, 
  GraduationCap, 
  Leaf, 
  RefreshCw, 
  Sliders, 
  Eye, 
  HelpCircle, 
  Clock, 
  Sparkles,
  AlertCircle,
  Award,
  BookMarked,
  Info,
  Youtube,
  Send,
  Loader2,
  ListRestart,
  Heart
} from "lucide-react";
import Sidebar from "./components/Sidebar";
import { Session, SessionFile, Message, QuizStats, FavoriteItem, ImportantConceptItem } from "./types";
import { formatFriendlyDate, formatTimeOnly, getLocalStorageSizeInKB, exportBackup, mergeSessions } from "./utils";

// Static suggested review questions
const BOTANIQUE_SUGGESTIONS = [
  "Quelles sont les caractéristiques des angiospermes dicotylédones ?",
  "Comment les plantes de climat aride limitent-elles l'évapotranspiration ?",
  "Explique le rôle du xylème et du phloème dans le transport de sève.",
  "Qu'est-ce que la classification phylogénétique ?"
];

const GEODYNAMIQUE_SUGGESTIONS = [
  "Explique le mécanisme de la tectonique des plaques au niveau d'une zone de subduction.",
  "Quelle est la différence entre le métamorphisme de contact et régional ?",
  "Comment se forment les rifts continentaux ?",
  "Décris le cycle de l'érosion et de la sédimentation hydrodynamique."
];

export default function App() {
  // Navigation and basic UI states
  const [activeTab, setActiveTab] = useState<string>("accueil");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [storageUpdated, setStorageUpdated] = useState<number>(Date.now());
  
  // Quiz statistics state
  const [quizStats, setQuizStats] = useState<QuizStats>({
    botaniqueDone: 0,
    botaniqueCorrect: 0,
    geodynamiqueDone: 0,
    geodynamiqueCorrect: 0,
    mixteDone: 0,
    mixteCorrect: 0
  });

  // Chat/Input states
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [fileList, setFileList] = useState<SessionFile[]>([]);
  const [dragActive, setDragActive] = useState(false);

  // Examen (Quiz Loop) Setup state
  const [quizSubject, setQuizSubject] = useState<"Botanique" | "Géodynamique" | "Mixte">("Botanique");
  const [quizFormat, setQuizFormat] = useState<"QCM" | "ouvert" | "mixte">("QCM");
  const [quizDifficulty, setQuizDifficulty] = useState<"facile" | "moyen" | "difficile" | "progressive">("moyen");
  const [quizTopic, setQuizTopic] = useState("");

  // Quiz active loop state
  const [isQuizActive, setIsQuizActive] = useState(false);
  const [currentQuestionData, setCurrentQuestionData] = useState<any>(null);
  const [userAnswerInput, setUserAnswerInput] = useState("");
  const [quizEvaluation, setQuizEvaluation] = useState<any>(null);
  const [quizHistory, setQuizHistory] = useState<any[]>([]); // Questions done in current session
  const [isQuizGenerating, setIsQuizGenerating] = useState(false);

  // Search/Filter states for Memory
  const [searchQuery, setSearchQuery] = useState("");
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  // Storage and Initialization
  useEffect(() => {
    // Load sessions
    const storedSessions = localStorage.getItem("carnet_sessions");
    if (storedSessions) {
      try {
        setSessions(JSON.parse(storedSessions));
      } catch (e) {
        console.error("Failed to parse sessions", e);
      }
    }
    
    // Load statistics
    const storedStats = localStorage.getItem("carnet_quiz_stats");
    if (storedStats) {
      try {
        setQuizStats(JSON.parse(storedStats));
      } catch (e) {
        console.error("Failed to parse stats", e);
      }
    }
  }, []);

  // Save changes helper
  const saveSessions = (updated: Session[]) => {
    setSessions(updated);
    localStorage.setItem("carnet_sessions", JSON.stringify(updated));
    setStorageUpdated(Date.now());
  };

  const saveStats = (updated: QuizStats) => {
    setQuizStats(updated);
    localStorage.setItem("carnet_quiz_stats", JSON.stringify(updated));
    setStorageUpdated(Date.now());
  };

  // Helper to find or lazy-create a session
  const getOrCreateSession = (toolType: Session["toolType"], subject: Session["subject"] = "Mixte") => {
    // Look for latest open session of this tool type
    const found = sessions.find(s => s.toolType === toolType);
    if (found) {
      setActiveSessionId(found.id);
      setFileList(found.files || []);
      return found.id;
    } else {
      // Create new one
      const newSess: Session = {
        id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: `Nouveau carnet — ${toolType === "01_document" ? "Fiches" : toolType === "02_libre" ? "Question libre" : toolType === "03_examen" ? "Entraînement Examen" : "Révision Active"}`,
        toolType,
        subject,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
        files: [],
        isFavorite: false,
        difficulty: "moyen",
        format: "QCM",
        topic: ""
      };
      const updatedList = [newSess, ...sessions];
      saveSessions(updatedList);
      setActiveSessionId(newSess.id);
      setFileList([]);
      return newSess.id;
    }
  };

  // Start new explicit blank session
  const handleStartNewSession = (toolType: Session["toolType"]) => {
    const subject = toolType === "02_libre" ? "Mixte" : "Botanique";
    const newSess: Session = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: `Carnet de Notes — ${new Date().toLocaleDateString("fr-FR")}`,
      toolType,
      subject,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      files: [],
      isFavorite: false,
      difficulty: toolType === "04_revision_active" ? "moyen" : undefined,
      format: toolType === "03_examen" ? "QCM" : undefined
    };
    saveSessions([newSess, ...sessions]);
    setActiveSessionId(newSess.id);
    setFileList([]);
    setIsQuizActive(false);
    setCurrentQuestionData(null);
    setUserAnswerInput("");
    setQuizEvaluation(null);
    setQuizHistory([]);
    
    // Redirect visual view to matching screen
    setActiveTab(toolType.replace("01_", "").replace("02_", "").replace("03_", "").replace("04_", ""));
  };

  // Active Session info
  const activeSession = sessions.find(s => s.id === activeSessionId);

  // Synchronize sidebar navigation changes
  const handleSidebarTabChange = (tabId: string) => {
    setActiveTab(tabId);
    
    if (["document", "libre", "examen", "revision_active"].includes(tabId)) {
      const toolMap: Record<string, Session["toolType"]> = {
        document: "01_document",
        libre: "02_libre",
        examen: "03_examen",
        revision_active: "04_revision_active"
      };
      
      const toolType = toolMap[tabId];
      // Check if current active session matches the selected tab, otherwise find/create
      if (!activeSession || activeSession.toolType !== toolType) {
        getOrCreateSession(toolType);
      }
    } else {
      // Memory pages (historique, favoris, etc.) on click do not require active session
      // But we can reset active session ID to keep dashboard clean
    }
  };

  // Drag & drop file handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files);
    }
  };

  // Convert files of any formats
  const handleFileSelection = async (files: FileList) => {
    if (!activeSessionId) return;
    const loadedFiles: SessionFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const isText = f.type.startsWith("text/") || f.name.endsWith(".txt");
      const isImage = f.type.startsWith("image/");
      const isPdf = f.type === "application/pdf" || f.name.endsWith(".pdf");

      if (isText) {
        const text = await f.text();
        loadedFiles.push({
          name: f.name,
          mimeType: f.type || "text/plain",
          textContent: text
        });
      } else if (isImage || isPdf) {
        // base64 conversion
        const reader = new FileReader();
        const promise = new Promise<SessionFile>((resolve) => {
          reader.onload = () => {
            const rawBase64 = (reader.result as string).split(",")[1];
            resolve({
              name: f.name,
              mimeType: f.type || (isPdf ? "application/pdf" : "image/jpeg"),
              base64: rawBase64
            });
          };
          reader.readAsDataURL(f);
        });
        const resultFile = await promise;
        loadedFiles.push(resultFile);
      } else {
        // Fallback placeholder txt
        loadedFiles.push({
          name: f.name,
          mimeType: "text/plain",
          textContent: `[Fichier de données : ${f.name} - ${f.size} octets]`
        });
      }
    }

    // Merge into session
    const updatedSess = sessions.map(s => {
      if (s.id === activeSessionId) {
        const mergedFiles = [...(s.files || []), ...loadedFiles];
        setFileList(mergedFiles);
        return {
          ...s,
          files: mergedFiles,
          updatedAt: Date.now()
        };
      }
      return s;
    });
    saveSessions(updatedSess);
  };

  const removeFile = (indexToRemove: number) => {
    if (!activeSessionId) return;
    const updatedSess = sessions.map(s => {
      if (s.id === activeSessionId) {
        const nextFiles = (s.files || []).filter((_, idx) => idx !== indexToRemove);
        setFileList(nextFiles);
        return {
          ...s,
          files: nextFiles,
          updatedAt: Date.now()
        };
      }
      return s;
    });
    saveSessions(updatedSess);
  };

  // Chat message submission
  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputText;
    if (!textToSend.trim() || !activeSessionId || isLoading) return;

    // Reset input field
    if (!customText) setInputText("");

    const userMsg: Message = {
      id: `msg_${Date.now()}_u`,
      role: "user",
      text: textToSend,
      timestamp: Date.now()
    };

    // Update session state locally with user message first
    let currentSessObj = sessions.find(s => s.id === activeSessionId);
    if (!currentSessObj) return;

    // Estimate subject automatic selection if user prompt contains keywords and currently General
    let autoSubject = currentSessObj.subject;
    const lowerText = textToSend.toLowerCase();
    const botKeywords = ["plante", "fleur", "angiosperme", "xylème", "phloème", "monocot", "sève", "botanique", "graine", "racine"];
    const geoKeywords = ["volcan", "subduction", "plaques", "rift", "faille", "érosion", "roche", "sédiment", "métamorphisme", "croûte", "lithosphère"];
    
    if (autoSubject === "Général" || autoSubject === "Mixte") {
      const hasBot = botKeywords.some(kw => lowerText.includes(kw));
      const hasGeo = geoKeywords.some(kw => lowerText.includes(kw));
      if (hasBot && hasGeo) autoSubject = "Mixte";
      else if (hasBot) autoSubject = "Botanique";
      else if (hasGeo) autoSubject = "Géodynamique";
    }

    const updatedSessionMessages = [...(currentSessObj.messages || []), userMsg];
    let updatedSessList = sessions.map(s => {
      if (s.id === activeSessionId) {
        return {
          ...s,
          messages: updatedSessionMessages,
          subject: autoSubject,
          updatedAt: Date.now()
        };
      }
      return s;
    });
    saveSessions(updatedSessList);
    setIsLoading(true);

    try {
      let response;
      if (currentSessObj.toolType === "02_libre") {
        response = await fetch("/api/chat-free", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updatedSessionMessages,
            subject: autoSubject
          })
        });
      } else {
        // This handles "01_document" and "04_revision_active"
        // In revision active, we also send the current score / user difficulty
        response = await fetch("/api/chat-document", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updatedSessionMessages,
            files: currentSessObj.files || [],
            toolType: currentSessObj.toolType,
            difficulty: currentSessObj.difficulty || "moyen"
          })
        });
      }

      if (!response.ok) {
        throw new Error(`Erreur serveur : ${response.statusText}`);
      }

      const resData = await response.json();
      
      const modelMsg: Message = {
        id: `msg_${Date.now()}_m`,
        role: "model",
        text: resData.text || "Je n'ai pas pu générer une réponse.",
        timestamp: Date.now(),
        keyConcept: resData.keyConcept,
        youtubeLinks: resData.youtubeLinks || [],
        suggestions: resData.suggestions || []
      };

      // Set adaptive difficulty based on answers if revision active
      let finalDifficulty = currentSessObj.difficulty || "moyen";
      if (currentSessObj.toolType === "04_revision_active") {
        // Adjust difficulty depending on user answering correct keywords
        const keywordsCount = (textToSend.match(/(exact|bonne|vrai|oui|effectivement|parfait|correct)/gi) || []).length;
        if (keywordsCount > 1 && finalDifficulty === "facile") finalDifficulty = "moyen";
        else if (keywordsCount > 1 && finalDifficulty === "moyen") finalDifficulty = "difficile";
        else if (textToSend.length < 5 && finalDifficulty === "difficile") finalDifficulty = "moyen";
      }

      const nextSessList = sessions.map(s => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            messages: [...updatedSessionMessages, modelMsg],
            difficulty: finalDifficulty,
            updatedAt: Date.now()
          };
        }
        return s;
      });
      saveSessions(nextSessList);

    } catch (err: any) {
      console.error(err);
      const errMsg: Message = {
        id: `msg_${Date.now()}_err`,
        role: "model",
        text: `⚠️ **Impossible de joindre le professeur de terrain.** Veuillez vérifier votre connexion ou votre clé d'API.\nDétail technique : ${err.message}`,
        timestamp: Date.now()
      };
      saveSessions(sessions.map(s => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            messages: [...updatedSessionMessages, errMsg],
            updatedAt: Date.now()
          };
        }
        return s;
      }));
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle Favorite on specific session
  const toggleSessionFavorite = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const updated = sessions.map(s => {
       if (s.id === id) {
         return { ...s, isFavorite: !s.isFavorite, updatedAt: Date.now() };
       }
       return s;
    });
    saveSessions(updated);
  };

  // Star / unstar a specific message
  const toggleMessageStar = (sessionId: string, messageId: string) => {
    const updated = sessions.map(s => {
      if (s.id === sessionId) {
        const nextMsgs = s.messages.map(m => {
          if (m.id === messageId) {
            // we will toggle a custom starred flag on the message
            return { ...m, isStarred: !(m as any).isStarred };
          }
          return m;
        });
        return { ...s, messages: nextMsgs, updatedAt: Date.now() };
      }
      return s;
    });
    saveSessions(updated);
  };

  // Delete session
  const handleDeleteSession = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const target = sessions.find(s => s.id === id);
    if (!target) return;

    const hasConfirmed = window.confirm(`Voulez-vous vraiment supprimer définitivement le carnet "${target.title}" ? Cette action est irréversible.`);
    if (hasConfirmed) {
      const updated = sessions.filter(s => s.id !== id);
      saveSessions(updated);
      if (activeSessionId === id) {
        setActiveSessionId(null);
        setActiveTab("accueil");
      }
    }
  };

  // Save renamed session title
  const handleSaveTitle = (id: string) => {
    if (!editingTitle.trim()) return;
    const updated = sessions.map(s => {
      if (s.id === id) {
        return { ...s, title: editingTitle.trim(), updatedAt: Date.now() };
      }
      return s;
    });
    saveSessions(updated);
    setEditingSessionId(null);
  };

  // Import Backup logic
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.sessions && Array.isArray(parsed.sessions)) {
          const merged = mergeSessions(sessions, parsed.sessions);
          saveSessions(merged);
          
          if (parsed.stats) {
            const mergedStats = {
              botaniqueDone: Math.max(quizStats.botaniqueDone, parsed.stats.botaniqueDone || 0),
              botaniqueCorrect: Math.max(quizStats.botaniqueCorrect, parsed.stats.botaniqueCorrect || 0),
              geodynamiqueDone: Math.max(quizStats.geodynamiqueDone, parsed.stats.geodynamiqueDone || 0),
              geodynamiqueCorrect: Math.max(quizStats.geodynamiqueCorrect, parsed.stats.geodynamiqueCorrect || 0),
              mixteDone: Math.max(quizStats.mixteDone, parsed.stats.mixteDone || 0),
              mixteCorrect: Math.max(quizStats.mixteCorrect, parsed.stats.mixteCorrect || 0)
            };
            saveStats(mergedStats);
          }
          alert("Sauvegarde importée et fusionnée avec succès !");
        } else {
          alert("Format de fichier incorrect. Clé 'sessions' introuvable.");
        }
      } catch (err) {
        alert("Impossible de lire la sauvegarde JSON. Assurez-vous d'avoir choisi le bon fichier exporté.");
      }
    };
    reader.readAsText(file);
  };

  // Interactive Quiz Functions
  const handleStartQuiz = async () => {
    setIsQuizActive(true);
    setIsQuizGenerating(true);
    setCurrentQuestionData(null);
    setQuizEvaluation(null);
    setUserAnswerInput("");
    setQuizHistory([]);

    try {
      const response = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          subject: quizSubject,
          format: quizFormat,
          difficulty: quizDifficulty,
          topic: quizTopic,
          history: []
        })
      });

      if (!response.ok) throw new Error("Erreur de génération du questionnaire.");
      const data = await response.json();
      setCurrentQuestionData(data);
    } catch (err) {
      alert("Erreur de connexion au serveur d'évaluation. Impossible de lancer l'examen.");
      setIsQuizActive(false);
    } finally {
      setIsQuizGenerating(false);
    }
  };

  const handleEvaluateAnswer = async () => {
    if (!currentQuestionData || !userAnswerInput.trim() || isQuizGenerating) return;
    setIsQuizGenerating(true);

    try {
      const response = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "evaluate",
          subject: quizSubject,
          currentQuestion: currentQuestionData.question,
          userAnswer: userAnswerInput,
          correctAnswer: currentQuestionData.correctAnswer
        })
      });

      if (!response.ok) throw new Error("Erreur d'évaluation.");
      const evalData = await response.json();
      setQuizEvaluation(evalData);

      // Save statistics according to subject
      const isCorrect = evalData.isCorrect;
      const nextStats = { ...quizStats };
      
      if (quizSubject === "Botanique") {
        nextStats.botaniqueDone += 1;
        if (isCorrect) nextStats.botaniqueCorrect += 1;
      } else if (quizSubject === "Géodynamique") {
        nextStats.geodynamiqueDone += 1;
        if (isCorrect) nextStats.geodynamiqueCorrect += 1;
      } else {
        nextStats.mixteDone += 1;
        if (isCorrect) nextStats.mixteCorrect += 1;
      }
      saveStats(nextStats);

      // Append results to current quiz history list
      setQuizHistory(prev => [
        ...prev,
        {
          question: currentQuestionData.question,
          userAnswer: userAnswerInput,
          correctAnswer: currentQuestionData.correctAnswer,
          isCorrect,
          explanation: evalData.explanation
        }
      ]);

      // If the AI highlighted this concept, auto log it in key concepts under relevant active exam session
      if (evalData.keyConcept && evalData.keyConcept.isKey) {
        // Construct simulated teacher response with explanation for memory review index
        const conceptMsg: Message = {
          id: `eval_msg_${Date.now()}`,
          role: "model",
          text: `#### Question Examen d'évaluation\n**Question** : ${currentQuestionData.question}\n\n**Réponse de l'étudiant** : ${userAnswerInput}\n\n**Correction** : ${isCorrect ? 'Correct ✅' : 'Incorrect ❌'}\n\n**Explication** : ${evalData.explanation}`,
          timestamp: Date.now(),
          keyConcept: evalData.keyConcept
        };

        // Inject this into current active exam session so the student can find it later in Important / Historique logs
        if (activeSessionId) {
          const nextSessList = sessions.map(s => {
            if (s.id === activeSessionId) {
              return {
                ...s,
                messages: [...(s.messages || []), conceptMsg],
                updatedAt: Date.now()
              };
            }
            return s;
          });
          saveSessions(nextSessList);
        }
      }

    } catch (err) {
      alert("Erreur de calcul lors de l'évaluation par l'IA.");
    } finally {
      setIsQuizGenerating(false);
    }
  };

  const handleNextQuestion = async () => {
    setIsQuizGenerating(true);
    setUserAnswerInput("");
    setQuizEvaluation(null);
    setCurrentQuestionData(null);

    try {
      const response = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          subject: quizSubject,
          format: quizFormat,
          difficulty: quizDifficulty,
          topic: quizTopic,
          history: quizHistory
        })
      });

      if (!response.ok) throw new Error("Erreur de génération.");
      const data = await response.json();
      setCurrentQuestionData(data);
    } catch (err) {
      alert("Erreur au chargement de la question suivante.");
    } finally {
      setIsQuizGenerating(false);
    }
  };

  const handleStopQuiz = () => {
    setIsQuizActive(false);
    setCurrentQuestionData(null);
    setUserAnswerInput("");
    setQuizEvaluation(null);
  };

  // Compile Memory items (stars and justifications from active localStorage store)
  const getStarredItems = (): FavoriteItem[] => {
    const list: FavoriteItem[] = [];
    
    // Add flagged sessions
    sessions.forEach(s => {
      if (s.isFavorite) {
        list.push({
          id: s.id,
          type: "session",
          sessionId: s.id,
          sessionTitle: s.title,
          toolType: s.toolType,
          subject: s.subject,
          timestamp: s.createdAt
        });
      }
      // Add individual starred messages
      if (s.messages) {
        s.messages.forEach(m => {
          if ((m as any).isStarred) {
            list.push({
              id: m.id,
              type: "message",
              sessionId: s.id,
              sessionTitle: s.title,
              toolType: s.toolType,
              subject: s.subject,
              timestamp: m.timestamp,
              messageId: m.id,
              messageText: m.text,
              keyConcept: m.keyConcept
            });
          }
        });
      }
    });

    return list.sort((a,b) => b.timestamp - a.timestamp);
  };

  const getImportantConcepts = (): ImportantConceptItem[] => {
    const list: ImportantConceptItem[] = [];
    sessions.forEach(s => {
      if (s.messages) {
        s.messages.forEach(m => {
          if (m.keyConcept && m.keyConcept.isKey) {
            list.push({
              id: m.id,
              sessionId: s.id,
              sessionTitle: s.title,
              toolType: s.toolType,
              concept: m.keyConcept,
              messageText: m.text,
              timestamp: m.timestamp
            });
          }
        });
      }
    });
    return list.sort((a, b) => b.timestamp - a.timestamp);
  };

  // Filter Historique sessions
  const getFilteredSessions = (): Session[] => {
    if (!searchQuery) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter(s => {
      const matchTitle = s.title.toLowerCase().includes(q);
      const matchSubject = s.subject.toLowerCase().includes(q);
      const matchMsg = s.messages?.some(m => m.text.toLowerCase().includes(q));
      return matchTitle || matchSubject || matchMsg;
    });
  };

  // Generate nice dynamic greeting greeting
  const getGreeting = () => {
    const now = new Date();
    const hours = now.getHours();
    if (hours < 12) return "Bonjour, botaniste de terrain ☀️";
    if (hours < 18) return "Bon après-midi, naturaliste 🌿";
    return "Bonsoir, géologue du soir 🌙";
  };

  return (
    <div id="applet-container" className="min-h-screen font-sans bg-creme select-text text-mousse-dark flex">
      {/* Dynamic persistent Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={handleSidebarTabChange}
        onExport={() => exportBackup({ sessions, stats: quizStats })}
        onImport={handleImportBackup}
        storageUpdated={storageUpdated}
      />

      {/* Main Journal Board */}
      <main className="flex-1 min-w-0 md:pl-0 pl-16 transition-all duration-300 relative py-6 px-4 md:px-8 max-w-7xl mx-auto space-y-6">
        
        {/* Banner with beautiful metadata */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 rounded-2xl border border-creme-dark bg-creme-paper shadow-sm gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2 w-2 rounded-full bg-mousse" />
              <p className="font-serif font-black text-xs uppercase tracking-widest text-terre">
                Carnet de notes herbiers & sédimentaires
              </p>
            </div>
            <h1 className="text-3xl font-serif font-black text-mousse-dark tracking-tight leading-none">
              Botanique & Géodynamique Externe
            </h1>
            <p className="text-sm font-sans text-mousse-medium mt-1">
              Plateforme connectée d'évaluation & fiches scientifiques • Licence Académique
            </p>
          </div>

          <div className="flex items-center gap-3 bg-creme/60 rounded-xl p-3 border border-creme-dark text-xs font-mono text-mousse">
            <Clock size={14} className="text-terre" />
            <div className="text-right">
              <div>Portail Révisions • UTC 16:12</div>
              <div className="text-terre font-semibold">Session Active</div>
            </div>
          </div>
        </header>

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: ACCUEIL */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "accueil" && (
          <div id="tab-accueil" className="space-y-6 animate-fade-in">
            {/* Welcome banner */}
            <div className="p-8 rounded-3xl bg-mousse text-creme-light shadow-lg flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
              <div className="space-y-2 max-w-xl">
                <span className="text-xs uppercase font-sans font-bold text-mousse-light tracking-widest block bg-mousse-dark/30 py-1 px-2.5 rounded-full inline-block">
                  {getGreeting()}
                </span>
                <h2 className="text-3xl font-serif font-black tracking-tight leading-tight">
                  Prêt pour l'expédition d'apprentissage ?
                </h2>
                <p className="text-sm text-mousse-light leading-relaxed">
                  Consultez vos relevés microscopiques, étudiez la tectonique sédimentaire et l'embryologie florale grâce à vos documents de cours géolocalisés.
                </p>
              </div>

              <div className="bg-creme-paper/10 border border-creme-light/20 p-4 rounded-2xl text-center self-stretch flex flex-col justify-center shrink-0 min-w-[200px]">
                <div className="text-xs uppercase text-mousse-light font-bold">Quiz réussis</div>
                <div className="text-3xl font-serif font-extrabold text-[#fcfaf5] my-1">
                  {quizStats.botaniqueCorrect + quizStats.geodynamiqueCorrect + quizStats.mixteCorrect}
                </div>
                <div className="text-[10px] text-mousse-light">
                  Total fait : {quizStats.botaniqueDone + quizStats.geodynamiqueDone + quizStats.mixteDone} sessions
                </div>
              </div>
            </div>

            {/* Quick Actions Shortcuts Grid */}
            <div>
              <h2 className="text-lg font-serif font-bold text-terre mb-4 flex items-center gap-2">
                <Sliders size={18} /> Vos Outils de Révision
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Box 1: Document */}
                <button
                  id="shortcut-outil-document"
                  onClick={() => handleSidebarTabChange("document")}
                  className="p-5 rounded-2xl border border-creme-dark bg-creme-paper text-left hover:shadow-md hover:border-mousse transition-all duration-300 group cursor-pointer flex flex-col justify-between h-44"
                >
                  <div className="bg-mousse-soft p-3 rounded-lg w-fit text-mousse">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-mousse-dark group-hover:text-mousse transition-colors text-base">
                      01 — Document
                    </h3>
                    <p className="text-xs text-mousse-medium mt-1 leading-snug">
                      Déposez vos PDF de cours d'embryologie ou tectonique pour extraire des bilans synthétiques.
                    </p>
                  </div>
                </button>

                {/* Box 2: Question libre */}
                <button
                  id="shortcut-outil-libre"
                  onClick={() => handleSidebarTabChange("libre")}
                  className="p-5 rounded-2xl border border-creme-dark bg-creme-paper text-left hover:shadow-md hover:border-mousse transition-all duration-300 group cursor-pointer flex flex-col justify-between h-44"
                >
                  <div className="bg-mousse-soft p-3 rounded-lg w-fit text-mousse">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-mousse-dark group-hover:text-mousse transition-colors text-base">
                      02 — Question libre
                    </h3>
                    <p className="text-xs text-mousse-medium mt-1 leading-snug">
                      Chat direct, suggestions de recherches en labo et liens vidéos YouTube de terrain.
                    </p>
                  </div>
                </button>

                {/* Box 3: Mode examen */}
                <button
                  id="shortcut-outil-examen"
                  onClick={() => handleSidebarTabChange("examen")}
                  className="p-5 rounded-2xl border border-creme-dark bg-creme-paper text-left hover:shadow-md hover:border-mousse transition-all duration-300 group cursor-pointer flex flex-col justify-between h-44"
                >
                  <div className="bg-mousse-soft p-3 rounded-lg w-fit text-mousse">
                    <GraduationCap size={20} />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-mousse-dark group-hover:text-mousse transition-colors text-base">
                      03 — Mode examen
                    </h3>
                    <p className="text-xs text-mousse-medium mt-1 leading-snug">
                      Interrogation par questions ouvertes ou QCM avec feedback scientifique strict et statistiques.
                    </p>
                  </div>
                </button>

                {/* Box 4: Révision active */}
                <button
                  id="shortcut-outil-revision_active"
                  onClick={() => handleSidebarTabChange("revision_active")}
                  className="p-5 rounded-2xl border border-creme-dark bg-creme-paper text-left hover:shadow-md hover:border-mousse transition-all duration-300 group cursor-pointer flex flex-col justify-between h-44"
                >
                  <div className="bg-mousse-soft p-3 rounded-lg w-fit text-mousse">
                    <Leaf size={20} />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-mousse-dark group-hover:text-mousse transition-colors text-base">
                      04 — Révision active
                    </h3>
                    <p className="text-xs text-mousse-medium mt-1 leading-snug">
                      Bilan documentaire interactif intégrant des questions-réponses adaptatives formulées par l'IA.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Recent Sessions list (5 most recent) */}
            <div className="p-6 rounded-2xl border border-creme-dark bg-creme-paper">
              <h2 className="text-lg font-serif font-bold text-mousse-dark mb-4 flex items-center justify-between">
                <span>📓 Sessions Récentes de Terrain (Top 5)</span>
                <button
                  id="btn-accueil-to-history"
                  onClick={() => handleSidebarTabChange("historique")}
                  className="text-xs font-sans text-terre hover:underline hover:text-mousse flex items-center gap-1 cursor-pointer"
                >
                  Tout l'historique ({sessions.length}) <ArrowRight size={14} />
                </button>
              </h2>

              {sessions.length === 0 ? (
                <div className="p-8 text-center bg-creme rounded-xl border border-dashed border-creme-dark text-mousse-medium space-y-2">
                  <p className="text-sm">Aucun carnet de notes de terrain entamé pour l'instant.</p>
                  <button 
                    id="btn-accueil-start-first"
                    onClick={() => handleStartNewSession("01_document")} 
                    className="px-4 py-2 bg-mousse text-creme-light rounded-lg text-xs font-sans font-bold hover:bg-mousse-dark transition-colors cursor-pointer"
                  >
                    Commencer à réviser
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {sessions.slice(0, 5).map((s) => {
                    const lastMsg = s.messages && s.messages.length > 0 ? s.messages[s.messages.length - 1] : null;
                    return (
                      <div 
                        key={s.id} 
                        className="p-4 rounded-xl border border-creme bg-creme-paper hover:bg-creme-paper/80 hover:border-mousse-light/40 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-serif font-bold text-mousse text-sm">{s.title}</span>
                            <span className="px-2 py-0.5 rounded bg-mousse-soft text-[10px] text-mousse-medium font-bold">
                              {s.toolType === "01_document" ? "01 — Document" : 
                               s.toolType === "02_libre" ? "02 — Libre" : 
                               s.toolType === "03_examen" ? "03 — Examen" : "04 — Révision Active"}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                              s.subject === "Botanique" ? "bg-green-100 text-green-800" :
                              s.subject === "Géodynamique" ? "bg-amber-100 text-amber-900" :
                              s.subject === "Mixte" ? "bg-blue-100 text-blue-900" : "bg-gray-100 text-gray-700"
                            }`}>
                              {s.subject}
                            </span>
                            {s.isFavorite && <Star size={12} className="text-yellow-500 fill-yellow-500" />}
                          </div>
                          
                          <p className="text-xs text-mousse-medium italic line-clamp-1 max-w-xl">
                            {lastMsg ? `Dernier message : "${lastMsg.text}"` : "Aucune note encodée."}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 self-stretch sm:self-auto justify-end">
                          <span className="text-[10px] text-mousse-medium font-mono">
                            {formatFriendlyDate(s.updatedAt)}
                          </span>
                          <button
                            id={`btn-resume-session-${s.id}`}
                            onClick={() => {
                              setActiveSessionId(s.id);
                              setFileList(s.files || []);
                              const tabMap: Record<string, string> = {
                                "01_document": "document",
                                "02_libre": "libre",
                                "03_examen": "examen",
                                "04_revision_active": "revision_active"
                              };
                              setActiveTab(tabMap[s.toolType]);
                            }}
                            className="p-2 py-1 bg-mousse-soft text-mousse hover:bg-mousse text-xs font-sans font-bold hover:text-creme-light rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <span>Ouvrir</span> <ArrowRight size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick presentation of the Botany and Geodynamics context */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl border border-creme-dark bg-[#faf7f0]">
                <h3 className="font-serif font-black text-terre text-sm uppercase tracking-wide mb-2 flex items-center gap-1">
                  🌱 Éléments de Botanique de Licence
                </h3>
                <ul className="text-xs text-mousse-medium space-y-1.5 list-disc pl-4 leading-relaxed">
                  <li><strong>Histologie végétale :</strong> Xylème (sève brute lignifiée), phloème (sève élaborée).</li>
                  <li><strong>Systématique :</strong> Monocotylédones (fleurs de type trilobées), Dicotylédones (pennées).</li>
                  <li><strong>Morphologique :</strong> Adaptations aux xérophytes, réduction de mérithalles, stomates cryptes.</li>
                </ul>
              </div>

              <div className="p-5 rounded-2xl border border-creme-dark bg-[#faf7f0]">
                <h3 className="font-serif font-black text-terre text-sm uppercase tracking-wide mb-2 flex items-center gap-1">
                  🌋 Éléments de Géodynamique Externe
                </h3>
                <ul className="text-xs text-mousse-medium space-y-1.5 list-disc pl-4 leading-relaxed">
                  <li><strong>Érosion & Sédimentation :</strong> Altération chimique, diagénèse, classification d'Hjulström.</li>
                  <li><strong>Processus Endogènes liés :</strong> Subsidence thermique des bassins, orogenèse hercynienne.</li>
                  <li><strong>Climatologie :</strong> Cycles de Milankovitch, forçage orbital et paléoclimats.</li>
                </ul>
              </div>
            </div>

          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: 01 — DOCUMENT */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "document" && activeSession && (
          <div id="tab-document" className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in">
            {/* Left side: Upload area & loaded files list */}
            <div className="lg:col-span-1 space-y-4">
              <div className="p-4 rounded-xl border border-creme-dark bg-[#faf7f0] space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-serif font-bold text-mousse-dark text-sm">📁 Documents Clés</h3>
                  <button
                    id="btn-doc-new-session"
                    onClick={() => handleStartNewSession("01_document")}
                    className="p-1 px-2 text-[10px] bg-mousse text-creme-light rounded hover:bg-mousse-dark flex items-center gap-1 font-sans cursor-pointer"
                    title="Sauvegarde le carnet actuel et démarre une nouvelle fiche de documents"
                  >
                    <Plus size={10} /> Nouveau
                  </button>
                </div>

                {/* Drag and Drop Zone */}
                <div 
                  id="dropzone-document"
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                    dragActive 
                      ? "border-mousse bg-mousse-soft" 
                      : "border-mousse-light/60 hover:border-mousse bg-creme-paper"
                  }`}
                  onClick={() => document.getElementById("file-picker")?.click()}
                >
                  <Upload size={24} className="mx-auto text-mousse hover:scale-110 transition-transform mb-2" />
                  <p className="text-xs font-sans font-bold text-mousse-dark leading-tight">
                    Faites glisser vos cours
                  </p>
                  <p className="text-[10px] text-mousse-medium mt-1">
                    PDF, Images, TXT acceptés simultanément
                  </p>
                  <input
                    id="file-picker"
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && handleFileSelection(e.target.files)}
                  />
                </div>

                {/* Loaded Chips list */}
                <div className="space-y-2">
                  <h4 className="text-xs uppercase font-bold text-terre tracking-wider">Documents analysés ({fileList.length})</h4>
                  {fileList.length === 0 ? (
                    <p className="text-xs text-mousse-medium italic">Aucune fiche déposée. Déposez vos PDF de cours ci-dessus.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {fileList.map((file, idx) => (
                        <div 
                          key={idx}
                          id={`file-chip-${idx}`}
                          className="flex items-center gap-1.5 px-2 py-1 rounded bg-creme text-[11px] font-mono text-mousse-dark border border-creme-dark"
                        >
                          <span className="truncate max-w-[120px]" title={file.name}>{file.name}</span>
                          <button 
                            id={`btn-remove-file-${idx}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(idx);
                            }}
                            className="text-red-700 hover:text-red-900 font-bold ml-1 cursor-pointer"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Study Info Card */}
              <div className="p-4 rounded-xl border border-creme-dark bg-creme-paper text-xs text-mousse-medium space-y-1.5">
                <p className="font-serif font-bold text-terre">💡 Précision géologique</p>
                <p>En analysant plusieurs fiches à la fois, l'IA précise systématiquement le nom du document d'origine et la page estimée pour structurer vos notes de terrain.</p>
              </div>
            </div>

            {/* Document Chat layout */}
            <div className="lg:col-span-3 flex flex-col h-[550px] rounded-2xl border border-creme-dark bg-creme-paper shadow-sm overflow-hidden">
              {/* Chat Title / Session Info */}
              <div className="p-4 bg-creme border-b border-creme-dark flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                  <FileText className="text-mousse" size={18} />
                  <div>
                    <span className="text-xs text-terre uppercase tracking-widest block font-bold">Fiches de révision Doc</span>
                    <span className="font-serif font-bold text-mousse-dark text-sm">{activeSession.title}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    id="btn-fav-session"
                    onClick={() => toggleSessionFavorite(activeSession.id)}
                    className="p-1.5 rounded-lg border border-creme bg-creme-paper hover:bg-mousse-soft cursor-pointer text-yellow-600 transition-all"
                    title="Marquer ce carnet comme favori"
                  >
                    <Star size={14} className={activeSession.isFavorite ? "fill-yellow-500 text-yellow-500" : ""} />
                  </button>
                </div>
              </div>

              {/* Chat body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 journal-paper" id="chat-scroller-doc">
                <div className="p-3.5 rounded-xl bg-mousse-soft border border-mousse-light/40 text-xs text-mousse leading-relaxed">
                  🎓 **Bienvenue dans l'espace Document !**
                  Déposez un ou plusieurs documents de cours (par exemple des herbiers, comptes rendus géologiques de terrain ou fiches schématiques). L'intelligence artificielle analysera en profondeur les données avant de répondre aux questions scientifiques.
                </div>

                {activeSession.messages?.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex flex-col max-w-[85%] ${msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 text-[10px] text-mousse-medium font-mono">
                      <span>{msg.role === "user" ? "Moi (Étudiant)" : "Tuteur Académique"}</span>
                      <span>•</span>
                      <span>{formatTimeOnly(msg.timestamp)}</span>
                    </div>

                    <div className={`p-3.5 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "user" 
                        ? "bg-mousse text-creme-light rounded-tr-none shadow-sm"
                        : "bg-creme text-mousse-dark rounded-tl-none border border-creme-dark/60 shadow-sm"
                    }`}>
                      {/* Message formatted with basic markdown rendering */}
                      <p className="whitespace-pre-line font-sans">{msg.text}</p>

                      {/* AI key concept flag badge */}
                      {msg.keyConcept?.isKey && (
                        <div className="mt-3 pt-2.5 border-t border-mousse-light/20 flex flex-col gap-1">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase w-fit ${
                            msg.keyConcept.type === "erreur fréquente" ? "bg-red-100 text-red-700" :
                            msg.keyConcept.type === "notion-clé" ? "bg-green-100 text-green-700" :
                            "bg-blue-100 text-blue-700"
                          }`}>
                            <Award size={10} /> {msg.keyConcept.type} sauvée !
                          </span>
                          <p className="text-[11px] text-mousse-medium italic">
                            💡 {msg.keyConcept.justification}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Actions under AI messages */}
                    {msg.role === "model" && (
                      <div className="flex items-center gap-2 mt-1 px-1.5">
                        <button
                          id={`btn-favorite-msg-${msg.id}`}
                          onClick={() => toggleMessageStar(activeSession.id, msg.id)}
                          className="flex items-center gap-1 text-[10px] text-mousse hover:text-yellow-600 transition-colors cursor-pointer"
                        >
                          <Star size={11} className={(msg as any).isStarred ? "text-yellow-500 fill-yellow-500" : "text-mousse-medium"} />
                          <span>Favori</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-center gap-2 text-xs text-mousse italic">
                    <Loader2 size={16} className="animate-spin text-mousse" />
                    <span>L'IA déchiffre vos relevés de terrain...</span>
                  </div>
                )}
              </div>

              {/* Chat Quick input form */}
              <div className="p-3.5 bg-creme border-t border-creme-dark flex gap-2 shrink-0">
                <textarea
                  id="chat-input-doc"
                  rows={1}
                  value={inputText}
                  placeholder="Posez votre question scientifique (ex: Analyse ce fossile ou Résume l'érosion)..."
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="flex-1 resize-none bg-creme-light rounded-xl border border-creme-dark p-2 px-3 text-sm focus:outline-none focus:border-mousse font-sans"
                />
                <button
                  id="btn-send-message-doc"
                  onClick={() => handleSendMessage()}
                  disabled={!inputText.trim() || isLoading}
                  className="bg-mousse text-creme-light p-2.5 rounded-xl hover:bg-mousse-dark disabled:opacity-50 transition-colors flex items-center justify-center cursor-pointer shrink-0"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: 02 — QUESTION LIBRE */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "libre" && activeSession && (
          <div id="tab-libre" className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in">
            {/* Left side suggested searches based on Botanique vs Geodynamique */}
            <div className="lg:col-span-1 space-y-4">
              <div className="p-4 rounded-xl border border-creme-dark bg-[#faf7f0] space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-serif font-bold text-mousse-dark text-sm">💡 Idées de recherche</h3>
                  <button
                    id="btn-libre-new-session"
                    onClick={() => handleStartNewSession("02_libre")}
                    className="p-1 px-2 text-[10px] bg-mousse text-creme-light rounded hover:bg-mousse-dark flex items-center gap-1 font-sans cursor-pointer"
                    title="Sauvegarde le carnet actuel et démarre une nouvelle session libre"
                  >
                    <Plus size={10} /> Nouveau
                  </button>
                </div>

                {/* Botany tips */}
                <div className="space-y-2">
                  <p className="text-[11px] uppercase font-bold text-terre tracking-wider">🌿 Botanique Licence</p>
                  <div className="flex flex-col gap-1.5">
                    {BOTANIQUE_SUGGESTIONS.map((sug, idx) => (
                      <button
                        key={idx}
                        id={`btn-sug-botanique-${idx}`}
                        onClick={() => handleSendMessage(sug)}
                        className="text-left w-full p-2 px-2.5 rounded bg-creme hover:bg-mousse-soft text-[11px] text-mousse-dark font-sans leading-snug border border-creme-dark/40 cursor-pointer hover:border-mousse transition-all"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Geodynamic tips */}
                <div className="space-y-2 pt-2 border-t border-creme-dark/40">
                  <p className="text-[11px] uppercase font-bold text-terre tracking-wider">🌋 Géodynamique Externe</p>
                  <div className="flex flex-col gap-1.5">
                    {GEODYNAMIQUE_SUGGESTIONS.map((sug, idx) => (
                      <button
                        key={idx}
                        id={`btn-sug-geodynamique-${idx}`}
                        onClick={() => handleSendMessage(sug)}
                        className="text-left w-full p-2 px-2.5 rounded bg-creme hover:bg-mousse-soft text-[11px] text-mousse-dark font-sans leading-snug border border-creme-dark/40 cursor-pointer hover:border-mousse transition-all"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Main Open Chat Layout */}
            <div className="lg:col-span-3 flex flex-col h-[550px] rounded-2xl border border-creme-dark bg-creme-paper shadow-sm overflow-hidden">
              <div className="p-4 bg-creme border-b border-creme-dark flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                  <BookOpen className="text-mousse" size={18} />
                  <div>
                    <span className="text-xs text-terre uppercase tracking-widest block font-bold">Carnet de discussions libres</span>
                    <span className="font-serif font-bold text-mousse-dark text-sm">{activeSession.title}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Select subject explicitly if user wants to center the expertise */}
                  <select
                    id="select-subject-explicit-libre"
                    value={activeSession.subject}
                    onChange={(e) => {
                      const updated = sessions.map(s => {
                        if (s.id === activeSession.id) {
                          return { ...s, subject: e.target.value as Session["subject"], updatedAt: Date.now() };
                        }
                        return s;
                      });
                      saveSessions(updated);
                    }}
                    className="p-1 px-2 text-xs bg-creme-light border border-creme-dark rounded font-sans text-mousse focus:outline-none"
                  >
                    <option value="Mixte">Expertise Mixte</option>
                    <option value="Botanique">Botanique</option>
                    <option value="Géodynamique">Géodynamique</option>
                  </select>

                  <button
                    id="btn-fav-session-libre"
                    onClick={() => toggleSessionFavorite(activeSession.id)}
                    className="p-1.5 rounded-lg border border-creme bg-creme-paper hover:bg-mousse-soft text-yellow-600 transition-all cursor-pointer"
                    title="Marquer ce carnet comme favori"
                  >
                    <Star size={14} className={activeSession.isFavorite ? "fill-yellow-500 text-yellow-500" : ""} />
                  </button>
                </div>
              </div>

              {/* Chat scroller */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 journal-paper" id="chat-scroller-libre">
                <div className="p-3.5 rounded-xl bg-[#fbf9f4] border border-creme-dark text-xs text-mousse leading-relaxed">
                  🌍 **Exploration libre !**
                  Posez n'importe quelle question théorique ou pratique relative à la géodynamique externe (diagénèse, altération des quartz, etc.) ou à la classification florale. L'IA recommandera des fiches clés, suggérera des sorties géologique de terrain adaptées et fournira des vidéos explicatives YouTube.
                </div>

                {activeSession.messages?.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex flex-col max-w-[85%] ${msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 text-[10px] text-mousse-medium font-mono">
                      <span>{msg.role === "user" ? "Moi" : "Tuteur Botanique & Géodynamique"}</span>
                      <span>•</span>
                      <span>{formatTimeOnly(msg.timestamp)}</span>
                    </div>

                    <div className={`p-3.5 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "user" 
                        ? "bg-mousse text-creme-light rounded-tr-none shadow-sm"
                        : "bg-creme text-mousse-dark rounded-tl-none border border-creme-dark/60 shadow-sm"
                    }`}>
                      <p className="whitespace-pre-line font-sans">{msg.text}</p>

                      {/* YouTube Recommendations generated by model */}
                      {msg.youtubeLinks && msg.youtubeLinks.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-mousse-light/20 space-y-2">
                          <span className="text-xs uppercase font-bold text-red-700 tracking-wider flex items-center gap-1">
                            <Youtube size={14} className="fill-red-700 text-red-700" /> Vidéos académiques de terrain :
                          </span>
                          <div className="flex flex-col gap-1.5">
                            {msg.youtubeLinks.map((yt, ytIdx) => (
                              <a
                                key={ytIdx}
                                href={yt.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-terre hover:underline flex items-center gap-1 bg-creme-light border border-creme-dark p-2 rounded hover:bg-mousse-soft transition-colors"
                              >
                                <Sparkles size={11} className="text-mousse" />
                                <span>{yt.title}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Quick contextual field suggestion chips generated by model */}
                      {msg.suggestions && msg.suggestions.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-mousse-light/20">
                          <span className="text-xs font-bold text-mousse block mb-1.5">💡 Sujets complémentaires recommandés :</span>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.suggestions.map((sug, sugIdx) => (
                              <button
                                key={sugIdx}
                                onClick={() => handleSendMessage(sug)}
                                className="text-[11px] bg-mousse-soft text-mousse-dark hover:bg-mousse-light/50 px-2.5 py-1 rounded transition-colors border border-mousse-light/30 cursor-pointer"
                              >
                                {sug}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* AI Key concepts auto flagger */}
                      {msg.keyConcept?.isKey && (
                        <div className="mt-3 pt-2.5 border-t border-mousse-light/20 flex flex-col gap-1">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase w-fit ${
                            msg.keyConcept.type === "erreur fréquente" ? "bg-red-100 text-red-700" :
                            msg.keyConcept.type === "notion-clé" ? "bg-green-100 text-green-700" :
                            "bg-blue-100 text-blue-700"
                          }`}>
                            <Award size={10} /> {msg.keyConcept.type} sauvée !
                          </span>
                          <p className="text-[11px] text-mousse-medium italic">
                            💡 {msg.keyConcept.justification}
                          </p>
                        </div>
                      )}
                    </div>

                    {msg.role === "model" && (
                      <div className="flex items-center gap-2 mt-1 px-1.5">
                        <button
                          id={`btn-favorite-msg-${msg.id}`}
                          onClick={() => toggleMessageStar(activeSession.id, msg.id)}
                          className="flex items-center gap-1 text-[10px] text-mousse hover:text-yellow-600 transition-colors cursor-pointer"
                        >
                          <Star size={11} className={(msg as any).isStarred ? "text-yellow-500 fill-yellow-500" : "text-mousse-medium"} />
                          <span>Favori</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-center gap-2 text-xs text-mousse italic">
                    <Loader2 size={16} className="animate-spin text-mousse" />
                    <span>L'enseignant botaniste étudie votre question...</span>
                  </div>
                )}
              </div>

              <div className="p-3.5 bg-creme border-t border-creme-dark flex gap-2 shrink-0">
                <textarea
                  id="chat-input-libre"
                  rows={1}
                  value={inputText}
                  placeholder="Posez votre question scientifique ou cliquez sur une suggestion..."
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="flex-1 resize-none bg-creme-light rounded-xl border border-creme-dark p-2 px-3 text-sm focus:outline-none focus:border-mousse font-sans"
                />
                <button
                  id="btn-send-message-libre"
                  onClick={() => handleSendMessage()}
                  disabled={!inputText.trim() || isLoading}
                  className="bg-mousse text-creme-light p-2.5 rounded-xl hover:bg-mousse-dark disabled:opacity-50 transition-colors flex items-center justify-center cursor-pointer shrink-0"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 4: 03 — MODE EXAMEN */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "examen" && (
          <div id="tab-examen" className="space-y-6 animate-fade-in">
            {/* Statistics panel at the top (required to update automatically) */}
            <div className="p-5 rounded-2xl border border-creme-dark bg-creme-paper space-y-4">
              <h2 className="text-sm font-serif font-bold text-mousse uppercase tracking-widest">
                📊 Vos Statistiques Cliniques — Mode Examen
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Botany stats */}
                <div className="p-4 rounded-xl border border-creme bg-[#fbf9f4] flex justify-between items-center">
                  <div>
                    <span className="text-xs text-green-800 bg-green-100 font-bold px-2 py-0.5 rounded">🌿 Botanique</span>
                    <div className="text-2xl font-serif font-black text-mousse-dark mt-2">
                      {quizStats.botaniqueDone > 0 
                        ? `${Math.round((quizStats.botaniqueCorrect / quizStats.botaniqueDone) * 100)}%` 
                        : "—"}
                    </div>
                    <div className="text-[10px] text-mousse-medium">Taux de réussite ({quizStats.botaniqueCorrect}/{quizStats.botaniqueDone})</div>
                  </div>
                  
                  {/* Visual mini progress circle in plain CSS */}
                  <div className="w-12 h-12 rounded-full border-4 border-creme-dark relative flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-mono text-mousse-medium">Bot</span>
                  </div>
                </div>

                {/* Geodynamic stats */}
                <div className="p-4 rounded-xl border border-creme bg-[#fbf9f4] flex justify-between items-center">
                  <div>
                    <span className="text-xs text-amber-950 bg-amber-100 font-bold px-2 py-0.5 rounded">🌋 Géodynamique</span>
                    <div className="text-2xl font-serif font-black text-mousse-dark mt-2">
                      {quizStats.geodynamiqueDone > 0 
                        ? `${Math.round((quizStats.geodynamiqueCorrect / quizStats.geodynamiqueDone) * 100)}%` 
                        : "—"}
                    </div>
                    <div className="text-[10px] text-mousse-medium">Taux de réussite ({quizStats.geodynamiqueCorrect}/{quizStats.geodynamiqueDone})</div>
                  </div>
                  
                  <div className="w-12 h-12 rounded-full border-4 border-creme-dark relative flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-mono text-mousse-medium font-bold">Géo</span>
                  </div>
                </div>

                {/* Mixed stats */}
                <div className="p-4 rounded-xl border border-creme bg-[#fbf9f4] flex justify-between items-center">
                  <div>
                    <span className="text-xs text-blue-900 bg-blue-100 font-bold px-2 py-0.5 rounded">🗺️ Mixte & Thématique</span>
                    <div className="text-2xl font-serif font-black text-mousse-dark mt-2">
                      {quizStats.mixteDone > 0 
                        ? `${Math.round((quizStats.mixteCorrect / quizStats.mixteDone) * 100)}%` 
                        : "—"}
                    </div>
                    <div className="text-[10px] text-mousse-medium">Taux de réussite ({quizStats.mixteCorrect}/{quizStats.mixteDone})</div>
                  </div>
                  
                  <div className="w-12 h-12 rounded-full border-4 border-creme-dark relative flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-mono text-mousse-medium">Mix</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Switch layout */}
            {!isQuizActive ? (
              /* Config Screen */
              <div className="p-6 rounded-2xl border border-creme-dark bg-creme-paper space-y-6">
                <div className="max-w-xl mx-auto space-y-4">
                  <div className="text-center space-y-2">
                    <GraduationCap size={44} className="mx-auto text-mousse" />
                    <h2 className="text-2xl font-serif font-black text-mousse-dark leading-tight">
                      Lancer l'Interrogation Académique
                    </h2>
                    <p className="text-xs text-mousse-medium">
                      Configurez vos critères d'examen. L'IA générera des questions adaptées au niveau Licence et modulera l'avancement selon vos réponses.
                    </p>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-creme-dark">
                    {/* Matiere */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase text-terre">Matière d'examen :</label>
                      <div className="grid grid-cols-3 gap-2">
                        {["Botanique", "Géodynamique", "Mixte"].map((item) => (
                          <button
                            key={item}
                            id={`btn-config-subject-${item}`}
                            onClick={() => setQuizSubject(item as any)}
                            className={`p-2.5 rounded-lg text-sm font-sans font-bold border transition-colors cursor-pointer ${
                              quizSubject === item 
                                ? "bg-mousse text-creme-light border-mousse shadow-sm" 
                                : "bg-creme text-mousse border-creme-dark hover:bg-mousse-soft"
                            }`}
                          >
                            {item === "Botanique" ? "🌿 Botanique" : item === "Géodynamique" ? "🌋 Géodynamique" : "🗺️ Mixte"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Format */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase text-terre">Format de question :</label>
                      <div className="grid grid-cols-3 gap-2">
                        {["QCM", "ouvert", "mixte"].map((item) => (
                          <button
                            key={item}
                            id={`btn-config-format-${item}`}
                            onClick={() => setQuizFormat(item as any)}
                            className={`p-2.5 rounded-lg text-sm font-sans font-bold border transition-colors cursor-pointer ${
                              quizFormat === item 
                                ? "bg-mousse text-creme-light border-mousse" 
                                : "bg-creme text-mousse border-creme-dark hover:bg-mousse-soft"
                            }`}
                          >
                            {item === "QCM" ? "📋 QCM (A, B, C, D)" : item === "ouvert" ? "✍️ Questions Ouvertes" : "🌀 Format Mixte"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Difficultes */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase text-terre">Niveau de Difficulté :</label>
                      <div className="grid grid-cols-4 gap-2">
                        {["facile", "moyen", "difficile", "progressive"].map((item) => (
                          <button
                            key={item}
                            id={`btn-config-diff-${item}`}
                            onClick={() => setQuizDifficulty(item as any)}
                            className={`p-2 rounded-lg text-xs font-sans font-bold border transition-colors cursor-pointer capitalize ${
                              quizDifficulty === item
                                ? "bg-mousse text-creme-light border-mousse"
                                : "bg-creme text-mousse border-creme-dark hover:bg-mousse-soft"
                            }`}
                          >
                            {item === "progressive" ? "⚡ Progressive" : item}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Sujet de Precision (Optional) */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase text-terre">
                        Sujet de cours précis (Facultatif) :
                      </label>
                      <input
                        id="input-config-topic"
                        type="text"
                        value={quizTopic}
                        placeholder="Ex: classification phylogénétique, tectonique des plaques, diagénèse..."
                        onChange={(e) => setQuizTopic(e.target.value)}
                        className="w-full bg-creme-light border border-creme-dark rounded-xl p-3 text-sm focus:outline-none focus:border-mousse font-sans"
                      />
                    </div>

                    {/* Submit */}
                    <button
                      id="btn-start-interrogation"
                      onClick={() => {
                        // Creating an ongoing active examination session
                        getOrCreateSession("03_examen", quizSubject);
                        handleStartQuiz();
                      }}
                      className="w-full p-4 bg-terre text-creme-paper rounded-xl font-serif font-black text-base shadow hover:bg-terre-dark transition-all duration-200 cursor-pointer text-center"
                    >
                      🌱 Commencer l'interrogation académique
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Quiz Loop Interface */
              <div className="p-6 rounded-2xl border border-creme-dark bg-creme-paper space-y-6">
                {/* Header of ongoing exam */}
                <div className="flex justify-between items-center border-b border-creme-dark pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-full bg-red-100 text-red-700 shrink-0 inline-block" />
                      <span className="text-xs font-mono font-bold text-mousse-medium uppercase tracking-wider">
                        Examen en cours : {quizSubject} ({quizDifficulty})
                      </span>
                    </div>
                    {quizTopic && (
                      <p className="text-xs font-sans text-terre">Thème d'étude : {quizTopic}</p>
                    )}
                  </div>

                  <button
                    id="btn-stop-examen"
                    onClick={handleStopQuiz}
                    className="p-2 px-3 text-xs bg-red-50 text-red-700 hover:bg-red-100 rounded-lg font-sans font-bold transition-all cursor-pointer"
                  >
                    Abandonner / Arrêter l'Examen
                  </button>
                </div>

                {/* Main Question Body */}
                <div className="max-w-2xl mx-auto space-y-6 py-4">
                  {isQuizGenerating && !currentQuestionData ? (
                    <div className="text-center py-12 space-y-3">
                      <Loader2 size={36} className="animate-spin text-mousse mx-auto" />
                      <p className="text-sm text-mousse-medium italic">Le jury de Licence formule la question...</p>
                    </div>
                  ) : currentQuestionData ? (
                    <div className="space-y-6">
                      {/* Floating prompt */}
                      <div className="p-5 rounded-2xl bg-[#faf7f0] border border-creme-dark shadow-sm space-y-4">
                        <span className="text-[10px] bg-mousse/15 text-mousse-medium font-bold px-2 py-0.5 rounded font-mono uppercase tracking-wider">
                          Question formulée :
                        </span>
                        <h3 className="text-lg font-serif font-bold text-mousse-dark leading-snug">
                          {currentQuestionData.question}
                        </h3>

                        {/* If QCM Options exist */}
                        {currentQuestionData.options && currentQuestionData.options.length > 0 && (
                          <div className="grid grid-cols-1 gap-2.5 pt-2">
                            {currentQuestionData.options.map((opt: string, optIdx: number) => {
                              // Standard prefix extractor (e.g. "A)")
                              const optLetter = opt.trim().substring(0,1);
                              const isSelected = userAnswerInput === optLetter || userAnswerInput === opt;
                              return (
                                <button
                                  key={optIdx}
                                  id={`btn-option-${optIndexToLetter(optIdx)}`}
                                  onClick={() => setUserAnswerInput(optLetter)}
                                  disabled={!!quizEvaluation}
                                  className={`p-3 text-left rounded-xl border text-xs font-sans transition-all cursor-pointer ${
                                    isSelected 
                                      ? "bg-mousse text-creme-light border-mousse shadow" 
                                      : "bg-creme-light text-mousse-dark border-creme-dark hover:bg-creme-light/40"
                                  }`}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Manual text answer input (if open format) */}
                      {(!currentQuestionData.options || currentQuestionData.options.length === 0) && (
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase text-terre">Saisissez votre réponse rédigée en français :</label>
                          <textarea
                            id="textarea-user-answer"
                            rows={3}
                            disabled={!!quizEvaluation}
                            value={userAnswerInput}
                            placeholder="Rédigez les notions botaniques ou géodynamiques nécessaires..."
                            onChange={(e) => setUserAnswerInput(e.target.value)}
                            className="w-full bg-creme-light border border-creme-dark rounded-xl p-3 text-sm focus:outline-none focus:border-mousse font-sans"
                          />
                        </div>
                      )}

                      {/* Submission of answer button */}
                      {!quizEvaluation && (
                        <button
                          id="btn-evaluate"
                          onClick={handleEvaluateAnswer}
                          disabled={!userAnswerInput.trim() || isQuizGenerating}
                          className="w-full p-3.5 bg-mousse text-creme-light rounded-xl hover:bg-mousse-dark font-sans font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isQuizGenerating ? (
                            <>
                              <Loader2 size={16} className="animate-spin" />
                              <span>Calcul de l'évaluation...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={16} />
                              <span>Soumettre pour correction académique</span>
                            </>
                          )}
                        </button>
                      )}

                      {/* Evaluation Results Banner */}
                      {quizEvaluation && (
                        <div className="space-y-4 animate-fade-in">
                          <div className={`p-5 rounded-2xl border flex items-start gap-4 ${
                            quizEvaluation.isCorrect 
                              ? "bg-green-50 border-green-200 text-green-950" 
                              : "bg-red-50 border-red-200 text-red-950"
                          }`}>
                            <div className="shrink-0 mt-0.5">
                              {quizEvaluation.isCorrect ? (
                                <CheckCircle2 size={24} className="text-green-700" />
                              ) : (
                                <XCircle size={24} className="text-red-700" />
                              )}
                            </div>

                            <div className="space-y-2 flex-1">
                              <h4 className="font-serif font-black text-base flex justify-between items-center">
                                <span>{quizEvaluation.isCorrect ? "Réponse ✅ Validée !" : "Réponse ❌ Rejetée."}</span>
                                <span className="text-xs px-2 py-0.5 rounded bg-white/60 font-mono text-mousse-medium uppercase">
                                  Corrigé
                                </span>
                              </h4>
                              
                              <p className="text-xs font-sans leading-relaxed">{quizEvaluation.explanation}</p>
                              
                              <div className="pt-2 text-[11px] border-t border-black/5 opacity-80">
                                <strong>Bonne réponse attendue :</strong> {quizEvaluation.correctAnswer}
                              </div>
                            </div>
                          </div>

                          {/* AI logged concept notice banner if keyConcept is present */}
                          {quizEvaluation.keyConcept?.isKey && (
                            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-2.5">
                              <Award size={16} className="text-blue-700 shrink-0 mt-0.5" />
                              <div>
                                <strong className="uppercase">Notion sauvegardée automatiquement :</strong>
                                <p className="italic mt-1 leading-snug">{quizEvaluation.keyConcept.justification}</p>
                              </div>
                            </div>
                          )}

                          {/* Next Button */}
                          <button
                            id="btn-quiz-next"
                            onClick={handleNextQuestion}
                            disabled={isQuizGenerating}
                            className="w-full p-3.5 bg-mousse text-creme-light rounded-xl hover:bg-mousse-dark font-sans font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                          >
                            <span>Passer à la question suivante</span>
                            <ArrowRight size={16} />
                          </button>
                        </div>
                      )}

                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 5: 04 — RÉVISION ACTIVE */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "revision_active" && activeSession && (
          <div id="tab-revision_active" className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in">
            {/* Left Column: Adaptive Level Indicator & file box */}
            <div className="lg:col-span-1 space-y-4">
              <div className="p-4 rounded-xl border border-creme-dark bg-[#faf7f0] space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-serif font-bold text-mousse-dark text-sm">🌱 État Révision Active</h3>
                  <button
                    id="btn-active-new-session"
                    onClick={() => handleStartNewSession("04_revision_active")}
                    className="p-1 px-2 text-[10px] bg-mousse text-creme-light rounded hover:bg-mousse-dark flex items-center gap-1 font-sans cursor-pointer"
                    title="Sauvegarde le carnet de révision actuel et démarre à neuf"
                  >
                    <Plus size={10} /> Nouveau
                  </button>
                </div>

                {/* Adaptive Level state badge */}
                <div className="p-3 rounded bg-mousse/5 border border-mousse/15 space-y-2 text-center">
                  <span className="text-[10px] text-mousse-medium uppercase tracking-widest font-bold">Niveau sémantique actuel</span>
                  <div className="text-xl font-serif font-black text-terre capitalize">{activeSession.difficulty || "moyen"}</div>
                  <p className="text-[10px] text-mousse-medium font-sans leading-snug pt-1 border-t border-creme-dark/30">
                    S'adapte automatiquement à l'exactitude de vos réponses.
                  </p>
                </div>

                {/* Drag and Drop Zone duplicates for Revision active */}
                <div 
                  id="dropzone-revision"
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                    dragActive 
                      ? "border-mousse bg-mousse-soft" 
                      : "border-mousse-light/60 hover:border-mousse bg-creme-paper"
                  }`}
                  onClick={() => document.getElementById("file-picker-revision")?.click()}
                >
                  <Upload size={20} className="mx-auto text-mousse hover:scale-115 transition-transform mb-1.5" />
                  <p className="text-xs font-sans font-bold text-mousse-dark leading-tight">
                    Fiches de cours actées
                  </p>
                  <p className="text-[10px] text-mousse-medium mt-1">
                    Ajoutez vos relevés botaniques
                  </p>
                  <input
                    id="file-picker-revision"
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && handleFileSelection(e.target.files)}
                  />
                </div>

                {/* File list */}
                <div className="space-y-2">
                  <h4 className="text-xs uppercase font-bold text-terre tracking-wider">Fiches Révision ({fileList.length})</h4>
                  {fileList.length === 0 ? (
                    <p className="text-xs text-mousse-medium italic">Aucun document chargé.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {fileList.map((file, idx) => (
                        <div 
                          key={idx}
                          id={`revision-file-chip-${idx}`}
                          className="flex items-center gap-1.5 px-2 py-1 rounded bg-creme text-[11px] font-mono text-mousse-dark border border-creme-dark"
                        >
                          <span className="truncate max-w-[120px]" title={file.name}>{file.name}</span>
                          <button 
                            id={`btn-remove-revision-file-${idx}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(idx);
                            }}
                            className="text-red-700 hover:text-red-900 font-bold ml-1 cursor-pointer"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Main Interactive Loop Panel */}
            <div className="lg:col-span-3 flex flex-col h-[550px] rounded-2xl border border-creme-dark bg-creme-paper shadow-sm overflow-hidden">
              <div className="p-4 bg-creme border-b border-creme-dark flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                  <Leaf className="text-mousse animate-pulse" size={18} />
                  <div>
                    <span className="text-xs text-terre uppercase tracking-widest block font-bold">🎯 Révision active adaptative</span>
                    <span className="font-serif font-bold text-mousse-dark text-sm">{activeSession.title}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    id="btn-fav-session-active"
                    onClick={() => toggleSessionFavorite(activeSession.id)}
                    className="p-1.5 rounded-lg border border-creme bg-creme-paper hover:bg-mousse-soft text-yellow-600 transition-all cursor-pointer"
                    title="Marquer ce carnet comme favori"
                  >
                    <Star size={14} className={activeSession.isFavorite ? "fill-yellow-500 text-yellow-500" : ""} />
                  </button>
                </div>
              </div>

              {/* Chat view */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 journal-paper" id="chat-scroller-active">
                <div className="p-3.5 rounded-xl bg bg-[#f8f6f0] border border-creme-dark text-xs text-mousse leading-relaxed">
                  🌱 **Comment fonctionne la révision active ?**
                  Précisez votre cours ou posez une question. L'IA étudiera votre document, vous répondra de façon structurée **ET** posera systématiquement une question de validation à la fin pour tester vos connaissances. Le rythme s'ajustera dynamiquement.
                </div>

                {activeSession.messages?.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex flex-col max-w-[85%] ${msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 text-[10px] text-mousse-medium font-mono">
                      <span>{msg.role === "user" ? "Moi" : "Examinateur Révision"}</span>
                      <span>•</span>
                      <span>{formatTimeOnly(msg.timestamp)}</span>
                    </div>

                    <div className={`p-3.5 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "user" 
                        ? "bg-mousse text-creme-light rounded-tr-none shadow-sm"
                        : "bg-creme text-mousse-dark rounded-tl-none border border-creme-dark/60 shadow-sm"
                    }`}>
                      <p className="whitespace-pre-line font-sans">{msg.text}</p>

                      {/* AI Key concepts indicator */}
                      {msg.keyConcept?.isKey && (
                        <div className="mt-3 pt-2.5 border-t border-mousse-light/20 flex flex-col gap-1">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase w-fit ${
                            msg.keyConcept.type === "erreur fréquente" ? "bg-red-100 text-red-700" :
                            msg.keyConcept.type === "notion-clé" ? "bg-green-100 text-green-700" :
                            "bg-blue-100 text-blue-700"
                          }`}>
                            <Award size={10} /> {msg.keyConcept.type} sauvée !
                          </span>
                          <p className="text-[11px] text-mousse-medium italic">
                            💡 {msg.keyConcept.justification}
                          </p>
                        </div>
                      )}
                    </div>

                    {msg.role === "model" && (
                      <div className="flex items-center gap-2 mt-1 px-1.5">
                        <button
                          id={`btn-favorite-msg-${msg.id}`}
                          onClick={() => toggleMessageStar(activeSession.id, msg.id)}
                          className="flex items-center gap-1 text-[10px] text-mousse hover:text-yellow-600 transition-colors cursor-pointer"
                        >
                          <Star size={11} className={(msg as any).isStarred ? "text-yellow-500 fill-yellow-500" : "text-mousse-medium"} />
                          <span>Favori</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-center gap-2 text-xs text-mousse italic">
                    <Loader2 size={16} className="animate-spin text-mousse" />
                    <span>Le professeur formule la question de contrôle...</span>
                  </div>
                )}
              </div>

              {/* Input for answers / next query */}
              <div className="p-3.5 bg-creme border-t border-creme-dark flex gap-2 shrink-0">
                <textarea
                  id="chat-input-active"
                  rows={1}
                  value={inputText}
                  placeholder="Répondez à la question posée ci-dessus ou soumettez de nouveaux critères..."
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="flex-1 resize-none bg-creme-light rounded-xl border border-creme-dark p-2 px-3 text-sm focus:outline-none focus:border-mousse font-sans"
                />
                <button
                  id="btn-send-message-active"
                  onClick={() => handleSendMessage()}
                  disabled={!inputText.trim() || isLoading}
                  className="bg-mousse text-creme-light p-2.5 rounded-xl hover:bg-mousse-dark disabled:opacity-50 transition-colors flex items-center justify-center cursor-pointer shrink-0"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 6: HISTORIQUE */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "historique" && (
          <div id="tab-historique" className="space-y-6 animate-fade-in">
            {/* Search filter banner */}
            <div className="p-5 rounded-2xl border border-creme-dark bg-creme-paper flex flex-col md:flex-row gap-4 justify-between items-center shadow-sm">
              <div className="space-y-1">
                <h2 className="text-lg font-serif font-bold text-mousse-dark">🔍 Historique Général du Carnet</h2>
                <p className="text-xs text-mousse-medium">Retrouvez, reprenez ou modifiez instantanément vos carnets scientifiques précédents.</p>
              </div>

              {/* Search input field */}
              <div className="relative w-full md:w-80">
                <Search size={16} className="absolute left-3 top-2.5 text-mousse-medium" />
                <input
                  id="search-history"
                  type="text"
                  value={searchQuery}
                  placeholder="Rechercher par mot-clé..."
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-creme border border-creme-dark rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-mousse font-sans"
                />
              </div>
            </div>

            {/* List of matching sessions */}
            <div className="space-y-3">
              {getFilteredSessions().length === 0 ? (
                <div className="p-12 text-center bg-creme-paper rounded-2xl border border-dashed border-creme-dark text-mousse-medium">
                  <p className="text-sm">Aucune session ne correspond à votre recherche ou historique vide.</p>
                </div>
              ) : (
                getFilteredSessions().map((s) => {
                  const lastMsg = s.messages && s.messages.length > 0 ? s.messages[s.messages.length - 1] : null;
                  const isEditing = editingSessionId === s.id;

                  return (
                    <div 
                      key={s.id} 
                      id={`history-card-${s.id}`}
                      className="p-5 rounded-2xl border border-creme-dark bg-creme-paper hover:bg-[#FAF7F0]/60 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                    >
                      {/* Left: Metadata and editable title */}
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Subject and tags badges */}
                          <span className="px-2 py-0.5 rounded bg-mousse-soft text-[10px] text-mousse-medium font-bold uppercase font-sans">
                            {s.toolType === "01_document" ? "01 — Document" : 
                             s.toolType === "02_libre" ? "02 — Libre" : 
                             s.toolType === "03_examen" ? "03 — Examen" : "04 — Révision Active"}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold font-sans ${
                            s.subject === "Botanique" ? "bg-green-100 text-green-800" :
                            s.subject === "Géodynamique" ? "bg-amber-100 text-amber-900" :
                            s.subject === "Mixte" ? "bg-blue-100 text-blue-900" : "bg-gray-100 text-gray-700"
                          }`}>
                            {s.subject}
                          </span>
                          
                          <span className="text-[10px] text-mousse-medium font-mono">
                            Créé le {formatFriendlyDate(s.createdAt)}
                          </span>
                        </div>

                        {/* Title inline edit */}
                        {isEditing ? (
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              id={`input-edit-title-${s.id}`}
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              className="bg-creme border border-mousse rounded py-1 px-2 text-sm font-sans font-bold text-mousse-dark focus:outline-none"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveTitle(s.id);
                              }}
                            />
                            <button
                              id={`btn-save-title-${s.id}`}
                              onClick={() => handleSaveTitle(s.id)}
                              className="px-2.5 py-1 bg-mousse text-creme-light rounded text-xs font-sans font-bold cursor-pointer"
                            >
                              Valider
                            </button>
                            <button
                              id={`btn-cancel-title-${s.id}`}
                              onClick={() => setEditingSessionId(null)}
                              className="px-2.5 py-1 bg-creme-dark text-mousse-dark rounded text-xs font-sans cursor-pointer"
                            >
                              Annuler
                            </button>
                          </div>
                        ) : (
                          <h3 
                            id={`title-session-${s.id}`}
                            onClick={() => {
                              setEditingSessionId(s.id);
                              setEditingTitle(s.title);
                            }}
                            className="text-base font-serif font-black text-mousse-dark hover:underline cursor-pointer flex items-center gap-2"
                            title="Cliquez pour renommer"
                          >
                            <span>{s.title}</span>
                            <span className="text-[10px] text-mousse-medium italic font-normal">(cliquez pour renommer)</span>
                          </h3>
                        )}

                        {/* Last message preview */}
                        <p className="text-xs text-mousse-medium font-sans italic line-clamp-1 max-w-2xl bg-[#faf7f0] p-2 rounded-lg border border-creme-dark/30">
                          {lastMsg ? lastMsg.text : "Aucun message ou note encodée dans ce carnet."}
                        </p>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 shrink-0 self-stretch md:self-auto justify-end">
                        {/* Favorite button */}
                        <button
                          id={`btn-fav-toggle-history-${s.id}`}
                          onClick={(e) => toggleSessionFavorite(s.id, e)}
                          className="p-2 rounded bg-creme border border-creme-dark hover:bg-mousse-soft text-yellow-600 transition-colors cursor-pointer"
                          title="Favori"
                        >
                          <Star size={14} className={s.isFavorite ? "fill-yellow-500 text-yellow-500" : "text-mousse-medium"} />
                        </button>

                        {/* Delete button */}
                        <button
                          id={`btn-delete-session-${s.id}`}
                          onClick={(e) => handleDeleteSession(s.id, e)}
                          className="p-2 rounded bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 transition-colors cursor-pointer"
                          title="Supprimer définitivement"
                        >
                          <Trash2 size={14} />
                        </button>

                        {/* Resume button */}
                        <button
                          id={`btn-resume-history-${s.id}`}
                          onClick={() => {
                            setActiveSessionId(s.id);
                            setFileList(s.files || []);
                            const tabMap: Record<string, string> = {
                              "01_document": "document",
                              "02_libre": "libre",
                              "03_examen": "examen",
                              "04_revision_active": "revision_active"
                            };
                            setActiveTab(tabMap[s.toolType]);
                          }}
                          className="p-2 px-3 bg-mousse text-creme-light hover:bg-mousse-dark rounded-xl text-xs font-sans font-bold transition-all cursor-pointer flex items-center gap-1"
                        >
                          <span>Reprendre</span> <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 7: FAVORIS */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "favoris" && (
          <div id="tab-favoris" className="space-y-6 animate-fade-in">
            <div className="p-5 rounded-2xl border border-creme-dark bg-creme-paper shadow-sm">
              <h2 className="text-lg font-serif font-black text-mousse-dark flex items-center gap-2">
                <Star size={18} className="text-yellow-500 fill-yellow-500" /> Vos Éléments Marqués en Favoris
              </h2>
              <p className="text-xs text-mousse-medium mt-1">Vous trouverez ici aussi bien des sessions entières de révisions herbiers étoilées, que des fiches de réponses et schémas d'IA spécifiques que vous avez sauvegardés.</p>
            </div>

            {getStarredItems().length === 0 ? (
              <div className="p-12 text-center bg-creme-paper rounded-2xl border border-dashed border-creme-dark text-mousse-medium">
                <p className="text-sm">Aucun élément favori pour l'instant.</p>
                <p className="text-xs mt-1">Étoilez une session ou cliquez sur "Favori" sous une réponse d'IA pour les archiver ici.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getStarredItems().map((fav) => (
                  <div 
                    key={fav.id} 
                    id={`fav-card-${fav.id}`}
                    className="p-5 rounded-2xl border border-creme-dark bg-creme-paper hover:bg-[#FAF7F0]/40 transition-all flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Type Indicator */}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          fav.type === "session" ? "bg-amber-100 text-amber-800" : "bg-purple-100 text-purple-800"
                        }`}>
                          {fav.type === "session" ? "📁 Session Sauvée" : "💬 Message Spécifique"}
                        </span>
                        
                        <span className="px-2 py-0.5 rounded bg-creme-dark text-[10px] font-mono text-mousse-medium uppercase font-bold">
                          {fav.toolType === "01_document" ? "01 — Doc" : 
                           fav.toolType === "02_libre" ? "02 — Libre" : 
                           fav.toolType === "03_examen" ? "03 — Examen" : "04 — Révision Active"}
                        </span>

                        <span className="text-[10px] text-mousse-medium font-mono">
                          {formatFriendlyDate(fav.timestamp)}
                        </span>
                      </div>

                      {/* Display content summary */}
                      {fav.type === "session" ? (
                        <div className="space-y-1">
                          <h3 className="font-serif font-black text-base text-mousse-dark">{fav.sessionTitle}</h3>
                          <p className="text-xs text-mousse-medium italic">Carnet global marqué favori.</p>
                        </div>
                      ) : (
                        <div className="space-y-1 bg-creme p-3 rounded-xl border border-creme-dark/60">
                          <h4 className="text-xs font-serif font-bold text-[#20150f]">{fav.sessionTitle}</h4>
                          <p className="text-xs text-mousse-medium leading-relaxed font-sans line-clamp-3">
                            {fav.messageText}
                          </p>

                          {fav.keyConcept && (
                            <div className="mt-2 pt-2 border-t border-creme-dark/50 text-[10px] text-mousse-medium italic">
                              💡 Justification de l'importance : {fav.keyConcept.justification}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Footer backlink button to restore */}
                    <div className="flex justify-end pt-2 border-t border-creme-dark/30">
                      <button
                        id={`btn-resume-fav-${fav.id}`}
                        onClick={() => {
                          setActiveSessionId(fav.sessionId);
                          const matchedSessionObj = sessions.find(s => s.id === fav.sessionId);
                          setFileList(matchedSessionObj?.files || []);
                          const tabMap: Record<string, string> = {
                            "01_document": "document",
                            "02_libre": "libre",
                            "03_examen": "examen",
                            "04_revision_active": "revision_active"
                          };
                          setActiveTab(tabMap[fav.toolType]);
                        }}
                        className="p-1 px-3 bg-mousse text-creme-light hover:bg-mousse-dark rounded-lg text-xs font-sans font-bold flex items-center gap-1 cursor-pointer transition-all"
                      >
                        Voir la Session d'origine <ArrowRight size={10} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 8: IMPORTANT */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "important" && (
          <div id="tab-important" className="space-y-6 animate-fade-in">
            <div className="p-5 rounded-2xl border border-creme-dark bg-creme-paper shadow-sm space-y-2">
              <h2 className="text-lg font-serif font-black text-mousse-dark flex items-center gap-2">
                <Award size={20} className="text-terre" /> Éléments Identifiés Importants par le Professeur
              </h2>
              <p className="text-xs text-mousse-medium">C'est le cahier des charges ultime pour vos examens ! L'intelligence artificielle repère automatiquement les <strong>notions clés de géologie / botanique</strong>, les <strong>erreurs fréquentes à absolument éviter</strong> et les <strong>résumés indispensables</strong>, puis les archive ici complets avec leur justification pour réviser à l'approche de l'évaluation.</p>
            </div>

            {getImportantConcepts().length === 0 ? (
              <div className="p-12 text-center bg-creme-paper rounded-2xl border border-dashed border-creme-dark text-mousse-medium">
                <p className="text-sm">Aucune notion d'examen jugée critique archivée par l'enseignant pour l'instant.</p>
                <p className="text-xs mt-1">Interagissez avec le chat document, question libre ou mode examen pour déclencher la synthèse automatique.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {getImportantConcepts().map((item) => (
                  <div 
                    key={item.id} 
                    id={`important-card-${item.id}`}
                    className="p-5 rounded-2xl border border-creme-dark bg-creme-paper hover:bg-[#FAF7F0]/40 transition-all flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-start gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase font-sans ${
                            item.concept.type === "erreur fréquente" ? "bg-red-100 text-red-700" :
                            item.concept.type === "notion-clé" ? "bg-green-100 text-green-700" :
                            "bg-blue-100 text-blue-700"
                          }`}>
                            <AlertCircle size={10} /> {item.concept.type}
                          </span>

                          <span className="px-2 py-0.5 rounded bg-creme-dark text-[10px] font-mono text-mousse-medium uppercase font-bold font-sans">
                            {item.toolType === "01_document" ? "01 — Doc" : 
                             item.toolType === "02_libre" ? "02 — Libre" : 
                             item.toolType === "03_examen" ? "03 — Examen" : "04 — Révision Active"}
                          </span>
                        </div>

                        <span className="text-[10px] text-mousse-medium font-mono">
                          Identifié le {formatFriendlyDate(item.timestamp)}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <h3 className="font-serif font-black text-sm text-[#2d1e18] bg-[#F1ECE1]/40 p-2.5 rounded border border-creme-dark">
                          <strong>Justification du Professeur :</strong> "{item.concept.justification}"
                        </h3>

                        <div className="p-4 rounded-xl bg bg-creme-paper border border-creme-dark/60 text-xs text-mousse-dark leading-relaxed font-sans prose whitespace-pre-line">
                          {item.messageText}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-creme-dark/30">
                      <span className="text-xs italic text-mousse-medium">Origine : {item.sessionTitle}</span>
                      <button
                        id={`btn-resume-important-${item.id}`}
                        onClick={() => {
                          setActiveSessionId(item.sessionId);
                          const matchedSessionObj = sessions.find(s => s.id === item.sessionId);
                          setFileList(matchedSessionObj?.files || []);
                          const tabMap: Record<string, string> = {
                            "01_document": "document",
                            "02_libre": "libre",
                            "03_examen": "examen",
                            "04_revision_active": "revision_active"
                          };
                          setActiveTab(tabMap[item.toolType]);
                        }}
                        className="p-1 px-3 bg-mousse text-creme-light hover:bg-mousse-dark rounded-lg text-xs font-sans font-bold flex items-center gap-1 cursor-pointer transition-all"
                      >
                        Consulter dans la Session <ArrowRight size={10} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}

// Helper simple mapping letter to option Index
function optIndexToLetter(idx: number): string {
  if (idx === 0) return "A";
  if (idx === 1) return "B";
  if (idx === 2) return "C";
  return "D";
}
