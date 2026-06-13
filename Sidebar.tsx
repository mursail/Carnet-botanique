import React, { useEffect, useState, useRef } from "react";
import { 
  Home, 
  FileText, 
  BookOpen, 
  GraduationCap, 
  Leaf, 
  History, 
  Star, 
  Award, 
  Download, 
  Upload, 
  Menu, 
  X, 
  Database,
  AlertTriangle
} from "lucide-react";
import { getLocalStorageSizeInKB } from "../utils";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  storageUpdated: number; // key to force refresh storage calculations
}

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  onExport, 
  onImport,
  storageUpdated
}: SidebarProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [storageSize, setStorageSize] = useState(0);
  const isHoveredRef = useRef(false);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Storage size monitoring
  useEffect(() => {
    setStorageSize(getLocalStorageSizeInKB());
  }, [storageUpdated, activeTab]);

  // Handle 3 taps / clicks anywhere on screen to toggle open
  useEffect(() => {
    let clickCount = 0;
    let clickTimer: NodeJS.Timeout | null = null;

    const handleGlobalClick = () => {
      clickCount++;
      if (clickTimer) clearTimeout(clickTimer);
      
      if (clickCount >= 3) {
        setIsOpen(true);
        resetAutoCloseTimer();
        clickCount = 0;
      } else {
        clickTimer = setTimeout(() => {
          clickCount = 0;
        }, 800); // 800ms window for triple tap
      }
    };

    window.addEventListener("click", handleGlobalClick);
    return () => {
      window.removeEventListener("click", handleGlobalClick);
      if (clickTimer) clearTimeout(clickTimer);
    };
  }, []);

  // Set up auto-close timer (reduces after 4 seconds of inactivity)
  const resetAutoCloseTimer = () => {
    if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
    if (!isOpen) return;
    
    timeoutIdRef.current = setTimeout(() => {
      if (!isHoveredRef.current) {
        setIsOpen(false);
      }
    }, 4000);
  };

  // Trigger auto-close timer on open state change
  useEffect(() => {
    if (isOpen) {
      resetAutoCloseTimer();
    }
    return () => {
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
    };
  }, [isOpen]);

  // Global window mousemove/click to reset auto close if open and not hovered
  useEffect(() => {
    const handleGlobalInactivityReset = () => {
      if (isOpen && !isHoveredRef.current) {
        resetAutoCloseTimer();
      }
    };

    window.addEventListener("mousemove", handleGlobalInactivityReset);
    window.addEventListener("keydown", handleGlobalInactivityReset);
    return () => {
      window.removeEventListener("mousemove", handleGlobalInactivityReset);
      window.removeEventListener("keydown", handleGlobalInactivityReset);
    };
  }, [isOpen]);

  const handleMouseEnter = () => {
    isHoveredRef.current = true;
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
  };

  const handleMouseLeave = () => {
    isHoveredRef.current = false;
    resetAutoCloseTimer();
  };

  const navItemsOutils = [
    { id: "accueil", label: "Accueil", icon: Home },
    { id: "document", label: "01 — Document", icon: FileText },
    { id: "libre", label: "02 — Question libre", icon: BookOpen },
    { id: "examen", label: "03 — Mode examen", icon: GraduationCap },
    { id: "revision_active", label: "04 — Révision active", icon: Leaf },
  ];

  const navItemsMemoire = [
    { id: "historique", label: "Historique", icon: History },
    { id: "favoris", label: "Favoris", icon: Star },
    { id: "important", label: "Important", icon: Award },
  ];

  // If storage is heavy (> 3.5MB / 3500KB or close to 5MB standard)
  const isStorageHeavy = storageSize > 3000;

  return (
    <>
      {/* Floating Toggle trigger visible when sidebar is closed */}
      {!isOpen && (
        <button
          id="btn-sidebar-trigger-open"
          onClick={() => setIsOpen(true)}
          className="fixed top-4 left-4 z-50 p-3 rounded-xl bg-mousse text-creme shadow-lg hover:bg-mousse-dark transition-all duration-300 flex items-center justify-center cursor-pointer border border-mousse-light/20"
          title="Ouvrir le carnet (Astuce : 3 clics rapides n'importe où pour ouvrir)"
        >
          <Menu size={20} />
        </button>
      )}

      {/* Sidebar Container */}
      <aside
        id="sidebar"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`fixed top-0 left-0 z-40 h-full w-72 bg-creme-paper border-r border-creme-dark flex flex-col justify-between shadow-xl transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-creme-dark flex justify-between items-center bg-creme">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-mousse flex items-center justify-center text-creme font-serif font-bold text-lg select-none">
              C
            </div>
            <div>
              <h1 className="font-serif font-bold text-[#2d1e18] tracking-tight leading-tight text-base">
                Carnet de Terrain
              </h1>
              <span className="text-xs font-sans text-mousse-medium uppercase tracking-wider font-semibold">
                Botanique & Géodynamique
              </span>
            </div>
          </div>
          <button
            id="btn-sidebar-close"
            onClick={() => setIsOpen(false)}
            className="p-1 rounded bg-creme-dark/50 text-mousse hover:bg-creme-dark hover:text-mousse-dark cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Content */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* Section Outils */}
          <div>
            <h3 className="px-3 text-xs font-sans uppercase font-bold tracking-widest text-terre mb-2">
              Outils de Révision
            </h3>
            <ul className="space-y-1">
              {navItemsOutils.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <li key={item.id}>
                    <button
                      id={`sidebar-tab-${item.id}`}
                      onClick={() => {
                        setActiveTab(item.id);
                        resetAutoCloseTimer();
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-sans transition-all duration-200 cursor-pointer ${
                        isActive
                          ? "bg-mousse text-creme-light font-semibold shadow-md"
                          : "text-mousse hover:bg-mousse-soft hover:text-mousse-dark"
                      }`}
                    >
                      <Icon size={18} className={isActive ? "text-creme-light" : "text-mousse-medium"} />
                      <span>{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Section Mémoire */}
          <div>
            <h3 className="px-3 text-xs font-sans uppercase font-bold tracking-widest text-terre mb-2">
              Mémoire de Terrain
            </h3>
            <ul className="space-y-1">
              {navItemsMemoire.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <li key={item.id}>
                    <button
                      id={`sidebar-tab-${item.id}`}
                      onClick={() => {
                        setActiveTab(item.id);
                        resetAutoCloseTimer();
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-sans transition-all duration-200 cursor-pointer ${
                        isActive
                          ? "bg-mousse text-creme-light font-semibold shadow-md"
                          : "text-mousse hover:bg-mousse-soft hover:text-mousse-dark"
                      }`}
                    >
                      <Icon size={18} className={isActive ? "text-creme-light" : "text-mousse-medium"} />
                      <span>{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Storage Size & Backup footer */}
        <div className="p-4 border-t border-creme-dark bg-creme space-y-3">
          {/* Storage Meter */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs font-sans font-medium text-mousse-dark">
              <span className="flex items-center gap-1">
                <Database size={12} className="text-mousse-medium" /> Stockage local
              </span>
              <span>{storageSize} KB / 4000 KB</span>
            </div>
            
            {/* Range bar */}
            <div className="w-full h-1.5 bg-creme-dark rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 rounded-full ${
                  isStorageHeavy ? "bg-red-500" : "bg-mousse-medium"
                }`}
                style={{ width: `${Math.min((storageSize / 4000) * 100, 100)}%` }}
              ></div>
            </div>

            {/* Heavy storage alarm */}
            {isStorageHeavy && (
              <div id="storage-warning-banner" className="flex items-start gap-1 p-2 rounded bg-red-50 text-red-700 text-[10px] leading-tight">
                <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                <span>Le cache devient lourd. Exportez vos révisions pour libérer de l'espace si besoin !</span>
              </div>
            )}
          </div>

          {/* Actions: Import, Export */}
          <div className="grid grid-cols-2 gap-2">
            {/* Export */}
            <button
              id="btn-export-backup"
              onClick={onExport}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-creme-light border border-mousse-light text-mousse-dark rounded-md text-xs font-sans hover:bg-mousse-soft cursor-pointer transition-colors"
              title="Télécharger une sauvegarde JSON complète de votre carnet"
            >
              <Download size={13} />
              <span>Exporter</span>
            </button>

            {/* Import (Trigger input) */}
            <button
              id="btn-import-trigger"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-mousse-soft text-mousse-dark rounded-md text-xs font-sans hover:bg-mousse-light cursor-pointer border border-transparent transition-colors"
              title="Fusionner un fichier de sauvegarde précédemment exporté"
            >
              <Upload size={13} />
              <span>Importer</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={onImport}
              className="hidden"
            />
          </div>
          
          <div className="text-center text-[9px] text-mousse-medium font-sans italic pt-1 border-t border-creme-dark/50">
            Faites 3 taps rapides n'importe où pour ouvrir/fermer le menu.
          </div>
        </div>
      </aside>
    </>
  );
}
