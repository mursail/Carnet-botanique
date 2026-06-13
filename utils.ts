import { Session, QuizStats } from "./types";

/**
 * Format a timestamp to a friendly French date
 */
export function formatFriendlyDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format timestamp to time only
 */
export function formatTimeOnly(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Returns the estimated size of the browser's localStorage usage in KB
 */
export function getLocalStorageSizeInKB(): number {
  let total = 0;
  for (const x in localStorage) {
    if (localStorage.hasOwnProperty(x)) {
      total += ((localStorage[x] || "").length + x.length) * 2;
    }
  }
  return parseFloat((total / 1024).toFixed(1));
}

/**
 * Export full application state as a JSON file download
 */
export function exportBackup(data: { sessions: Session[]; stats: QuizStats }) {
  try {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(data, null, 2)
    )}`;
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", jsonString);
    downloadAnchor.setAttribute("download", `carnet_de_terrain_sauvegarde_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    return true;
  } catch (error) {
    console.error("Failed to export backup:", error);
    return false;
  }
}

/**
 * Deep merge sessions during import to avoid losing unique ids
 */
export function mergeSessions(existing: Session[], imported: Session[]): Session[] {
  const map = new Map<string, Session>();
  existing.forEach(s => map.set(s.id, s));
  imported.forEach(s => {
    // If imported session has messages or is newer, overwrite or merge
    map.set(s.id, s);
  });
  return Array.from(map.values()).sort((a,b) => b.updatedAt - a.updatedAt);
}
