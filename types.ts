export interface KeyConcept {
  isKey: boolean;
  type: "notion-clé" | "erreur fréquente" | "résumé important";
  justification: string;
}

export interface YouTubeLink {
  title: string;
  url: string;
}

export interface Message {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: number;
  keyConcept?: KeyConcept | null;
  youtubeLinks?: YouTubeLink[];
  suggestions?: string[];
}

export interface SessionFile {
  name: string;
  mimeType: string;
  base64?: string; // pure base64 for images / PDFs
  textContent?: string; // plain text content for txt files
}

export interface Session {
  id: string;
  title: string;
  toolType: "01_document" | "02_libre" | "03_examen" | "04_revision_active";
  subject: "Botanique" | "Géodynamique" | "Mixte" | "Général";
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  files: SessionFile[];
  isFavorite: boolean;
  
  // Examen parameters
  difficulty?: "facile" | "moyen" | "difficile" | "progressive";
  format?: "QCM" | "ouvert" | "mixte";
  topic?: string;
}

export interface QuizStats {
  botaniqueDone: number;
  botaniqueCorrect: number;
  geodynamiqueDone: number;
  geodynamiqueCorrect: number;
  mixteDone: number;
  mixteCorrect: number;
}

export interface FavoriteItem {
  id: string; // session id, or unique id for message
  type: "session" | "message";
  sessionId: string;
  sessionTitle: string;
  toolType: Session["toolType"];
  subject: Session["subject"];
  timestamp: number;
  messageId?: string; // if type === "message"
  messageText?: string; // if type === "message"
  keyConcept?: KeyConcept | null; // if type === "message"
}

export interface ImportantConceptItem {
  id: string; // messageId
  sessionId: string;
  sessionTitle: string;
  toolType: Session["toolType"];
  concept: KeyConcept;
  messageText: string;
  timestamp: number;
}
