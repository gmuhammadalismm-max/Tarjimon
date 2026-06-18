/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from "react";
import { 
  Languages, 
  UploadCloud, 
  FileText, 
  Check, 
  Copy, 
  Download, 
  Sparkles, 
  BookOpen, 
  Cpu, 
  Briefcase, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  FileCheck, 
  AlertCircle, 
  FileDown, 
  Printer, 
  Settings,
  HelpCircle,
  History,
  Volume2,
  VolumeX,
  Award,
  Activity,
  BookMarked,
  Scale
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Markdown from "react-markdown";

type StyleType = "Badiiy" | "Ilmiy" | "Rasmiy";

// Realistic sample templates for quick testing
const TEMPLATES: Record<StyleType, { title: string; label: string; text: string; glossary: string }> = {
  Badiiy: {
    title: "Sherlock Holmes adabiy asari",
    label: "Badiiy (Literary)",
    text: `It was a wild, cold, seasonable night of pale moonlight and windy shadows. The street was wet after a recent shower, and the gas lamps gleamed on the glistening pavement. "My dear Watson," Holmes whispered as we stood huddled in our long coats, "the game is afoot. Not a word, not a breath, but follow me closely, for tonight we shall either unravel the most singular mystery of our careers or die in the attempt."`,
    glossary: "Watson = Uotson\nthe game is afoot = ov boshlandi / ish qizidi\nsingular mystery = tengsiz jumboq"
  },
  Ilmiy: {
    title: "Kvant hisoblash va sun'iy intellekt",
    label: "Ilmiy (Scientific)",
    text: `Quantum computing leverages the principles of superposition and entanglement to process complex algorithmic operations at speeds exponentially faster than conventional classical silicon-based architectures. When applied to machine learning training loops, quantum neural networks (QNN) can significantly mitigate the gradient descent vanishing problem, thereby optimizing weight distribution convergence in a fraction of the traditional computational runtime.`,
    glossary: "superposition = superpozitsiya\nentanglement = chalkashlik / kvant bog'liqligi\nvanishing problem = yo'qolib ketish muammosi\ncomputational runtime = hisoblash vaqti"
  },
  Rasmiy: {
    title: "Xalqaro hamkorlik shartnomasi",
    label: "Rasmiy (Official/Legal)",
    text: `The Parties hereby agree to establish a strategic framework of mutual cooperation in the field of information systems development. In witness whereof, the undermentioned representatives, being duly authorized by their respective boards of directors, have signed this Memorandum of Understanding. This MOU shall remain in full force and effect for a period of five (5) years, unless terminated earlier by a written thirty-day prior notification of either Party.`,
    glossary: "The Parties hereby agree = Tomonlar buning bilan kelishadilar\nstrategic framework = strategik asoslar\nMemorandum of Understanding = Anglashuv memorandumi\nin full force and effect = to'liq qonuniy kuchda"
  }
};

interface HistoryItem {
  id: string;
  sourceText: string;
  translatedText: string;
  style: StyleType;
  model: string;
  timestamp: number;
}

interface GlossaryTerm {
  id: string;
  english: string;
  uzbek: string;
}

// Safe localStorage wrapper to prevent crash inside sandbox iframes
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {
      console.warn("Storage is blocked in this environment:", e);
    }
    return null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn("Storage is blocked in this environment:", e);
    }
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn("Storage is blocked in this environment:", e);
    }
  }
};

export default function App() {
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<StyleType>("Rasmiy");
  const [customInstructions, setCustomInstructions] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>("gemini-3.5-flash");
  
  // App states
  const [isLoading, setIsLoading] = useState(false);
  const [isFileLoading, setIsFileLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTranslation, setEditedTranslation] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [translatingChunkIndex, setTranslatingChunkIndex] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);

  // Advanced States
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  const [glossaryTerms, setGlossaryTerms] = useState<GlossaryTerm[]>([
    { id: "g1", english: "the game is afoot", uzbek: "ish qizidi / ov boshlandi" },
    { id: "g2", english: "Memorandum of Understanding", uzbek: "Anglashuv memorandumi" },
    { id: "g3", english: "computation", uzbek: "hisoblash jarayoni" }
  ]);
  const [activeTab, setActiveTab] = useState<"tarjima" | "tahlil" | "lughat">("tarjima");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Audio browser synthesis support
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        synthRef.current = window.speechSynthesis;
      }
    } catch (e) {
      console.warn("Speech synthesis is not accessible or blocked in this context:", e);
    }
  }, []);

  // Retrieve History on load
  useEffect(() => {
    try {
      const stored = safeLocalStorage.getItem("tarjimon_history");
      if (stored) {
        setHistoryList(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Xatolik tarixni o'qishda:", e);
    }
  }, []);

  // Update Custom instructions when glossary list changes
  useEffect(() => {
    if (glossaryTerms.length > 0) {
      const formatted = glossaryTerms
        .filter(t => t.english.trim() || t.uzbek.trim())
        .map(t => `${t.english.trim()} = ${t.uzbek.trim()}`)
        .join("\n");
      setCustomInstructions(formatted);
    }
  }, [glossaryTerms]);

  // Stats
  const sourceWordCount = sourceText.trim() ? sourceText.trim().split(/\s+/).length : 0;
  const sourceCharCount = sourceText.length;
  const targetWordCount = (isEditing ? editedTranslation : translatedText).trim() 
    ? (isEditing ? editedTranslation : translatedText).trim().split(/\s+/).length 
    : 0;

  // Loading Steps texts
  const LOADING_STEPS = [
    "Kiritilgan matn tarkibi tahlil qilinmoqda...",
    "Kontekstual qoidalar va tarjima modeli yuklanmoqda...",
    "Gemini AI o'zbek tiliga o'girmoqda (ravon va aniq shaklda)...",
    "Mukammal shaklga silliqlanmoqda...",
    "Tayyor!"
  ];

  // Rotate loading steps while translation runs
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev < LOADING_STEPS.length - 2 ? prev + 1 : prev));
      }, 3500);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  // Sync edited text back if compiled text changes
  useEffect(() => {
    setEditedTranslation(translatedText);
  }, [translatedText]);

  // Get current translation style theme colors
  const getThemeClasses = () => {
    switch (selectedStyle) {
      case "Badiiy":
        return {
          primary: "bg-amber-600 hover:bg-amber-700 text-white",
          accent: "text-amber-600",
          bgLight: "bg-amber-50/50",
          border: "border-amber-200 focus:border-amber-500 focus:ring-amber-200",
          accentBg: "bg-amber-100/70 text-amber-800",
          gradient: "from-amber-600 to-orange-500",
          gradientLight: "from-amber-50 to-orange-50/30",
          tagBg: "bg-amber-50 border-amber-200 text-amber-800",
          btnOutline: "border-amber-200 text-amber-700 hover:bg-amber-50"
        };
      case "Ilmiy":
        return {
          primary: "bg-sky-600 hover:bg-sky-700 text-white",
          accent: "text-sky-600",
          bgLight: "bg-sky-50/50",
          border: "border-sky-200 focus:border-sky-500 focus:ring-sky-200",
          accentBg: "bg-sky-100/70 text-sky-800",
          gradient: "from-sky-600 to-indigo-600",
          gradientLight: "from-sky-50 to-indigo-50/30",
          tagBg: "bg-sky-50 border-sky-200 text-sky-800",
          btnOutline: "border-sky-200 text-sky-700 hover:bg-sky-50"
        };
      case "Rasmiy":
      default:
        return {
          primary: "bg-emerald-700 hover:bg-emerald-800 text-white",
          accent: "text-emerald-700",
          bgLight: "bg-emerald-50/50",
          border: "border-emerald-200 focus:border-emerald-500 focus:ring-emerald-200",
          accentBg: "bg-emerald-100/70 text-emerald-800",
          gradient: "from-emerald-700 to-teal-600",
          gradientLight: "from-emerald-50 to-teal-50/30",
          tagBg: "bg-emerald-50 border-emerald-200 text-emerald-800",
          btnOutline: "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
        };
    }
  };

  const theme = getThemeClasses();

  // Load interactive templates
  const handleLoadTemplate = (style: StyleType) => {
    setSelectedStyle(style);
    setSourceText(TEMPLATES[style].text);
    setCustomInstructions(TEMPLATES[style].glossary);
    setFileName(null);
    setErrorMessage("");
  };

  // Drag and Drop files
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    if (!file) return;
    
    const extension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    const isDocxOrPdf = extension === ".pdf" || extension === ".docx";
    const allowedExtensions = [".txt", ".md", ".json", ".csv", ".xml", ".html", ".pdf", ".docx", ""];
    
    if (!allowedExtensions.includes(extension) && !file.type.startsWith("text/")) {
      setErrorMessage("Faqat matnli (.txt, .md, .json), Word (.docx) va PDF (.pdf) hujjatlar qabul qilinadi.");
      return;
    }

    setFileName(file.name);
    setErrorMessage("");

    if (isDocxOrPdf) {
      setIsFileLoading(true);
      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const dataUrl = e.target?.result as string;
            if (!dataUrl) {
              throw new Error("Fayl tarkibini yuklashda xatolik.");
            }
            const commaIndex = dataUrl.indexOf(",");
            if (commaIndex === -1) {
              throw new Error("Faylni base64 formatiga o'gira olmadik.");
            }
            const base64Data = dataUrl.substring(commaIndex + 1);

            const res = await fetch("/api/parse-document", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ base64Data, fileName: file.name }),
            });

            const data = await res.json();
            if (!res.ok) {
              throw new Error(data.error || "Hujjatni tahlil qilishda server xatosi yuz berdi.");
            }

            const parsedText = typeof data.text === "string" 
              ? data.text 
              : (Array.isArray(data.text) ? data.text.join("\n") : "");

            if (parsedText && parsedText.trim()) {
              setSourceText(parsedText);
            } else {
              setSourceText("");
              setErrorMessage("Hujjatdan foydali matn ajratib bo'lmadi. Faylda matn emas, rasm/skanerlangan pdf bo'lishi mumkin.");
            }
          } catch (err: any) {
            setErrorMessage(err.message || "Hujjatni o'qib olishda xatolik yuz berdi.");
          } finally {
            setIsFileLoading(false);
          }
        };

        reader.onerror = () => {
          setErrorMessage("Faylni yuklashda xatolik yuz berdi.");
          setIsFileLoading(false);
        };

        reader.readAsDataURL(file);
      } catch (err: any) {
        setErrorMessage(err.message || "Faylni tayyorlashda xatolik.");
        setIsFileLoading(false);
      }
    } else {
      // Plain text files
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (text) {
          setSourceText(text);
        }
      };
      reader.onerror = () => {
        setErrorMessage("Faylni o'qishda xatolik yuz berdi.");
      };
      reader.readAsText(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Helper to split text into manageable paragraphs of approx 1500 words
  const splitTextIntoChunks = (text: string, maxWords = 1500) => {
    const paragraphs = text.split(/\n/);
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentWordCount = 0;

    for (const para of paragraphs) {
      const cleanPara = para.trim();
      const wordCount = cleanPara ? cleanPara.split(/\s+/).length : 0;
      
      if (currentWordCount + wordCount > maxWords && currentChunk.length > 0) {
        chunks.push(currentChunk.join("\n"));
        currentChunk = [para];
        currentWordCount = wordCount;
      } else {
        currentChunk.push(para);
        currentWordCount += wordCount;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join("\n"));
    }
    return chunks;
  };

  // Perform translation with smart chunking to support over 20,000 words securely
  const translateText = async () => {
    if (!sourceText.trim()) return;
    
    setIsLoading(true);
    setErrorMessage("");
    setTranslatedText("");
    setIsEditing(false);
    
    const chunks = splitTextIntoChunks(sourceText, 1500);
    setTotalChunks(chunks.length);
    setTranslatingChunkIndex(1);

    let accumulatedTranslation = "";

    try {
      for (let i = 0; i < chunks.length; i++) {
        setTranslatingChunkIndex(i + 1);
        
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: chunks[i],
            style: selectedStyle,
            customInstructions,
            model: selectedModel,
          }),
        });

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || `Tarjima qilish jarayonida (${i + 1}-qismda) xatolik yuz berdi.`);
        }

        const chunkResult = data.translatedText || "";
        accumulatedTranslation += (accumulatedTranslation ? "\n\n" : "") + chunkResult;
        
        // Progressively showcase results in output panel for extreme user convenience
        setTranslatedText(accumulatedTranslation);
        setActiveTab("tarjima"); // switch back to result translation tab
      }

      // Save to translation history dynamically (persistent local cache)
      const newItem: HistoryItem = {
        id: Math.random().toString(36).substring(2, 9),
        sourceText: sourceText,
        translatedText: accumulatedTranslation,
        style: selectedStyle,
        model: selectedModel,
        timestamp: Date.now()
      };
      setHistoryList((prev) => {
        const u = [newItem, ...prev].slice(0, 40); // keep up to 40 items
        try {
          safeLocalStorage.setItem("tarjimon_history", JSON.stringify(u));
        } catch(e) {
          console.error("Local storage sync error", e);
        }
        return u;
      });
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || "Tizim ulanishda xato berdi. Internetni tekshirib qayta urinib ko'ring.");
    } finally {
      setIsLoading(false);
    }
  };

  // Utilities
  const handleCopy = async () => {
    const textToCopy = isEditing ? editedTranslation : translatedText;
    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Nusxa ko'chirish amalga oshmadi", err);
    }
  };

  const downloadFile = (format: "md" | "txt" | "doc") => {
    const content = isEditing ? editedTranslation : translatedText;
    if (!content) return;
    
    let element = document.createElement("a");
    let file: Blob;
    
    if (format === "doc") {
      // Convert basic Markdown to rich HTML paragraphs, headings and list structures
      const htmlContent = content
        .replace(/^(#{3,})\s*(.*)$/gm, "<h3>$2</h3>")
        .replace(/^(#{2,})\s*(.*)$/gm, "<h2>$2</h2>")
        .replace(/^(#{1,})\s*(.*)$/gm, "<h1>$2</h1>")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/\n\s*-\s*(.*)/g, "<li>$1</li>")
        .replace(/\n/g, "<br/>");

      const documentHtml = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <title>O'zbek Tili Professional Tarjimasi</title>
          <style>
            body { font-family: 'Arial', sans-serif; line-height: 1.6; }
            h1 { font-family: 'Arial', sans-serif; font-size: 18pt; color: #01573d; margin-bottom: 12pt; border-bottom: 1px solid #e2e8f0; padding-bottom: 6pt; }
            h2 { font-family: 'Arial', sans-serif; font-size: 14pt; color: #1e293b; margin-top: 18pt; margin-bottom: 6pt; }
            h3 { font-family: 'Arial', sans-serif; font-size: 12pt; color: #334155; margin-top: 14pt; margin-bottom: 4pt; }
            p { font-size: 11pt; color: #334155; margin-bottom: 10pt; }
            strong { font-weight: bold; color: #000000; }
            li { font-size: 11pt; color: #334155; margin-bottom: 4pt; }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
        </html>
      `;
      file = new Blob(['\ufeff' + documentHtml], { type: 'application/msword;charset=utf-8' });
    } else {
      file = new Blob([content], { type: "text/plain;charset=utf-8" });
    }
    
    element.href = URL.createObjectURL(file);
    const userFileName = fileName && fileName.includes(".") ? fileName.substring(0, fileName.lastIndexOf(".")) : (fileName || "tarjima");
    element.download = `${userFileName}_uzbek_${selectedStyle.toLowerCase()}.${format === "doc" ? "doc" : format}`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSpeak = () => {
    if (!synthRef.current) return;
    if (isSpeaking) {
      synthRef.current.cancel();
      setIsSpeaking(false);
      return;
    }
    const txt = isEditing ? editedTranslation : translatedText;
    if (!txt) return;

    // clean markdown tags before speaking
    const cleanText = txt
      .replace(/[#*`_~]/g, "")
      .replace(/\[(.*?)\]\(.*?\)/g, "$1")
      .slice(0, 1000); // safety length cap for web speech

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voices = synthRef.current.getVoices();
    // try to find Uzbek-like voicing, default to Turkish/European values which match phonetic layouts relatively well
    const matchedVoice = voices.find(v => v.lang.startsWith("uz") || v.lang.startsWith("tr") || v.lang.startsWith("az") || v.lang.includes("RU")) || voices[0];
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    setIsSpeaking(true);
    synthRef.current.speak(utterance);
  };

  const handleLoadHistory = (item: HistoryItem) => {
    setSourceText(item.sourceText);
    setTranslatedText(item.translatedText);
    setSelectedStyle(item.style);
    if (item.model) {
      setSelectedModel(item.model);
    }
    setFileName(null);
    setErrorMessage("");
    setActiveTab("tarjima");
    setIsHistoryOpen(false);
  };

  const handleDeleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistoryList((prev) => {
      const u = prev.filter((item) => item.id !== id);
      try {
        safeLocalStorage.setItem("tarjimon_history", JSON.stringify(u));
      } catch (err) {
        console.error(err);
      }
      return u;
    });
  };

  const handleClearHistory = () => {
    try {
      if (typeof window !== "undefined" && window.confirm("Barcha tarjimalar tarixini tozalashni xohlaysizmi?")) {
        setHistoryList([]);
        try {
          safeLocalStorage.removeItem("tarjimon_history");
        } catch (err) {
          console.error(err);
        }
      }
    } catch (e) {
      // Direct clear fallback if window.confirm is restricted by iframe sandboxing policies
      setHistoryList([]);
      safeLocalStorage.removeItem("tarjimon_history");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans transition-colors duration-300">
      
      {/* Visual background elements */}
      <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-slate-100/50 to-transparent pointer-events-none -z-10" />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col space-y-6">
        
        {/* Title and credits section */}
        <div className="text-center md:text-left flex flex-col md:flex-row md:items-end justify-between border-b border-slate-200 pb-5">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold font-display tracking-tight text-slate-900 flex items-center space-x-2 justify-center md:justify-start">
              <span>Tarjimon AI</span>
            </h1>
            <p className="text-xs text-slate-500">
              powered by <a href="https://muhammadai.uz" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 underline font-semibold transition-colors duration-200">muhammadai.uz</a>
            </p>
          </div>
          <div className="mt-2 md:mt-0 flex items-center justify-center space-x-2">
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full inline-flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
              <span>Gemini Pro Active</span>
            </span>
          </div>
        </div>
        
        {/* Style selection cards (Interactive, premium design) */}
        <section className="print:hidden">
          <div className="flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-2">
                <Settings className="w-3.5 h-3.5" />
                <span>Birinchi Qadam: Matn tarjima uslubini tanlang</span>
              </h2>
              <div className="text-xs text-slate-400 flex items-center space-x-1">
                <HelpCircle className="w-3" />
                <span>Har bir uslub uchun alohida lisoniy qoidalar qo'llaniladi</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Rasmiy Style selector */}
              <button
                id="btn-style-rasmiy"
                type="button"
                onClick={() => setSelectedStyle("Rasmiy")}
                className={`relative p-4 rounded-xl text-left border transition-all flex flex-col justify-between ${
                  selectedStyle === "Rasmiy"
                    ? "bg-emerald-50/60 border-emerald-500 ring-2 ring-emerald-500/10 shadow-sm"
                    : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
                }`}
              >
                <div className="flex items-center space-x-3 mb-2">
                  <div className={`p-2 rounded-lg ${selectedStyle === "Rasmiy" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 text-sm">Rasmiy / Ish yuritish</h3>
                    <span className="text-[10px] text-slate-400 font-medium">Shartnoma, Qonuniyat, Biznes</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Hujjatlar va diplomatik aloqalarga mos qat'iy mantiqiy uslub. Normativ va huquqiy atamalardan foydalaniladi.
                </p>
                {selectedStyle === "Rasmiy" && (
                  <span className="absolute top-3 right-3 flex h-2 w-2 rounded-full bg-emerald-500" />
                )}
              </button>

              {/* Ilmiy Style selector */}
              <button
                id="btn-style-ilmiy"
                type="button"
                onClick={() => setSelectedStyle("Ilmiy")}
                className={`relative p-4 rounded-xl text-left border transition-all flex flex-col justify-between ${
                  selectedStyle === "Ilmiy"
                    ? "bg-sky-50/60 border-sky-500 ring-2 ring-sky-500/10 shadow-sm"
                    : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
                }`}
              >
                <div className="flex items-center space-x-3 mb-2">
                  <div className={`p-2 rounded-lg ${selectedStyle === "Ilmiy" ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 text-sm">Ilmiy / Akademik</h3>
                    <span className="text-[10px] text-slate-400 font-medium">Maqola, Texnika, Matematika</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Soha atamalari (IT, fizika, tibbiyot) rasmiy va muqobil variantiga to'liq o'giriladi, formulalar saqlanadi.
                </p>
                {selectedStyle === "Ilmiy" && (
                  <span className="absolute top-3 right-3 flex h-2 w-2 rounded-full bg-sky-500" />
                )}
              </button>

              {/* Badiiy Style selector */}
              <button
                id="btn-style-badiiy"
                type="button"
                onClick={() => setSelectedStyle("Badiiy")}
                className={`relative p-4 rounded-xl text-left border transition-all flex flex-col justify-between ${
                  selectedStyle === "Badiiy"
                    ? "bg-amber-50/60 border-amber-500 ring-2 ring-amber-500/10 shadow-sm"
                    : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
                }`}
              >
                <div className="flex items-center space-x-3 mb-2">
                  <div className={`p-2 rounded-lg ${selectedStyle === "Badiiy" ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 text-sm">Badiiy / Adabiy</h3>
                    <span className="text-[10px] text-slate-400 font-medium">Kitoblar, Tarix, Tasvirlar</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Har bir iborani jonli va tushunarli badiiy o'zbek tiliga o'tkazadi, o'zbek xalq maqollari yoki o'xshatishlari qo'shiladi.
                </p>
                {selectedStyle === "Badiiy" && (
                  <span className="absolute top-3 right-3 flex h-2 w-2 rounded-full bg-amber-500" />
                )}
              </button>

            </div>
          </div>
        </section>

        {/* Model selection cards (Interactive, premium design) */}
        <section className="print:hidden">
          <div className="flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-2">
                <Cpu className="w-3.5 h-3.5" />
                <span>Ikkinchi Qadam: Sun'iy intellekt modelini tanlang</span>
              </h2>
              <div className="text-xs text-slate-400 flex items-center space-x-1.5 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse"></span>
                <span className="text-[10px] text-indigo-700 font-medium">Uzluksiz ulanish (Auto-fallback) faol</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Gemini 3.5 Flash */}
              <button
                id="btn-model-35-flash"
                type="button"
                onClick={() => setSelectedModel("gemini-3.5-flash")}
                className={`relative p-3 rounded-xl text-left border transition-all flex items-center space-x-3 cursor-pointer ${
                  selectedModel === "gemini-3.5-flash"
                    ? "bg-indigo-50/60 border-indigo-500 ring-2 ring-indigo-500/10 shadow-sm"
                    : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
                }`}
              >
                <div className={`p-1.5 rounded-lg ${selectedModel === "gemini-3.5-flash" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-slate-800 text-xs">Gemini 3.5 Flash</h4>
                  <p className="text-[10px] text-slate-500">Standart, lisoniy nozikliklar va mantiq uchun mukammal o'girish tizimi</p>
                </div>
                {selectedModel === "gemini-3.5-flash" && (
                  <Check className="w-4 h-4 text-indigo-600" />
                )}
              </button>

              {/* Gemini 3.1 Flash Lite */}
              <button
                id="btn-model-31-lite"
                type="button"
                onClick={() => setSelectedModel("gemini-3.1-flash-lite")}
                className={`relative p-3 rounded-xl text-left border transition-all flex items-center space-x-3 cursor-pointer ${
                  selectedModel === "gemini-3.1-flash-lite"
                    ? "bg-indigo-50/60 border-indigo-500 ring-2 ring-indigo-500/10 shadow-sm"
                    : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
                }`}
              >
                <div className={`p-1.5 rounded-lg ${selectedModel === "gemini-3.1-flash-lite" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                  <Cpu className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-slate-800 text-xs">Gemini 3.1 Flash Lite</h4>
                  <p className="text-[10px] text-slate-500">Tez va tezkor tezlik, murakkab bolmagan matnlarni o'girish uchun</p>
                </div>
                {selectedModel === "gemini-3.1-flash-lite" && (
                  <Check className="w-4 h-4 text-indigo-600" />
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Extreme Performance & Scale Information Banner */}
        <section className="bg-emerald-50 border border-emerald-100/80 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden text-xs shadow-xs">
          <div className="flex items-start sm:items-center space-x-3 text-emerald-900 leading-relaxed">
            <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <p className="font-bold text-[13px] text-emerald-950 flex items-center space-x-1.5">
                <span>20,000 so'zgacha xavfsiz va bo'laklab tarjima qilish faollashtirildi</span>
                <span className="bg-emerald-600 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-center">YANGI</span>
              </p>
              <p className="text-emerald-800 text-[11px] mt-0.5">
                Kitoblar, akademik dissertatsiyalar va yirik shartnomalarni xavfsiz va uzilishlarsiz tarjima qiling. Matn avtomatik ravishda 1500 so'zdan qilib mantiqiy bo'linadi va xatosiz o'giriladi.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full flex items-center space-x-1">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Dinamik Chunking faol</span>
            </span>
          </div>
        </section>

        {/* Demo Templates quick selector */}
        <section className="bg-slate-100/70 py-2.5 px-4 rounded-xl border border-slate-200/60 flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0 print:hidden text-xs">
          <div className="text-slate-500 font-medium flex items-center space-x-2">
            <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold text-[10px]">E'LON</span>
            <span>Sinab ko'rish uchun tezkor demo variantlar:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["Rasmiy", "Ilmiy", "Badiiy"] as StyleType[]).map((style) => (
              <button
                key={style}
                id={`btn-template-${style.toLowerCase()}`}
                type="button"
                onClick={() => handleLoadTemplate(style)}
                className="bg-white hover:bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md cursor-pointer transition text-slate-700 font-medium flex items-center space-x-1"
              >
                <Plus className="w-3 h-3 text-slate-400" />
                <span>{style} Matni ({style === "Badiiy" ? "Sh. Holmes" : style === "Ilmiy" ? "Kvant AI" : "MOU"})</span>
              </button>
            ))}
          </div>
        </section>

        {/* Workspace Dual-Pane Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          
          {/* Left Panel: Kiritish / Input */}
          <div className="flex flex-col space-y-4 print:hidden">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center space-x-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${theme.primary.split(" ")[0]} animate-pulse`} />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Tarjima Matni (Inglizcha / Boshqa til)</span>
                </div>
                <div className="flex items-center space-x-2">
                  {sourceText && (
                    <button
                      id="btn-clear-source"
                      type="button"
                      onClick={() => {
                        setSourceText("");
                        setFileName(null);
                        setErrorMessage("");
                      }}
                      className="text-slate-400 hover:text-red-500 text-xs flex items-center space-x-1 font-medium transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Tozalash</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Textarea */}
              <div className="relative">
                <textarea
                  id="source-text-input"
                  rows={12}
                  className="w-full p-5 text-slate-800 placeholder-slate-400 focus:outline-hidden resize-y min-h-[280px] text-sm leading-relaxed border-0 focus:ring-0"
                  placeholder="Tarjima qilinadigan xorijiy matnni bu yerga kiriting, nusxa qo'shing yoki quyidagi sohadan hujjat yuklang..."
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  disabled={isFileLoading}
                />

                {/* File Parsing Loading Overlay */}
                {isFileLoading && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] flex flex-col items-center justify-center space-y-3 z-20">
                    <div className="w-10 h-10 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
                    <div className="text-center space-y-1">
                      <p className="text-xs font-bold text-slate-800 tracking-tight animate-pulse">Hujjatdan matn ajratib olingmoqda...</p>
                      <p className="text-[10px] text-slate-400">PDF va Word tarkibidagi lisoniy bloklar saralanmoqda</p>
                    </div>
                  </div>
                )}

                {/* Word & Symbol count absolute overlay bar */}
                <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[11px] text-slate-400 font-medium pointer-events-none">
                  <div className="flex items-center space-x-3 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-md border border-slate-100 shadow-xs">
                    <span>So'zlar: <strong className="text-slate-600">{sourceWordCount}</strong></span>
                    <span className="text-slate-200">|</span>
                    <span>Belgilar: <strong className="text-slate-600">{sourceCharCount}</strong></span>
                  </div>
                  {fileName && (
                    <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 px-2 py-0.5 rounded flex items-center space-x-1">
                      <FileCheck className="w-3 h-3" />
                      <span>{fileName}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* File Upload Zone */}
              <div 
                className={`border-t border-slate-100 p-5 bg-slate-50/50 transition-all ${
                  dragActive ? "bg-indigo-50 border-indigo-400" : ""
                }`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
              >
                <div className="border border-dashed border-slate-200 hover:border-slate-300 rounded-xl bg-white p-4 text-center transition cursor-pointer flex flex-col items-center relative group">
                  <input
                    type="file"
                    id="file-upload-input"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={handleFileInput}
                    accept=".txt,.md,.json,.csv,.xml,.html,.pdf,.docx"
                    disabled={isFileLoading}
                  />
                  <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-slate-500 mb-2 transition-transform group-hover:-translate-y-0.5" />
                  <p className="text-xs font-semibold text-slate-700">O'zbekchaga o'g'irish uchun PDF, Word yoki matnli hujjat yuklang</p>
                  <p className="text-[10px] text-slate-400 mt-1">Nomi .pdf, .docx, .txt, .md, .json bo'lgan fayllar qo'llab-quvvatlanadi</p>
                </div>
              </div>

            </div>

            {/* Custom rules/directives Drawer */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-2">
                  <BookMarked className="w-4 h-4 text-indigo-600" />
                  <span>Maxsus Lisoniy Kengaytmalar</span>
                </span>
                <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-medium">Faol</span>
              </div>

              {/* Glossary Grid Builder */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase">Atamalar va tarjima mosliklari (CAT Glossary)</h4>
                  <span className="text-[10px] text-indigo-600 font-semibold">{glossaryTerms.length} ta so'z biriktirilgan</span>
                </div>

                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {glossaryTerms.map((term) => (
                    <div key={term.id} className="flex items-center space-x-2 bg-slate-50 border border-slate-200/60 p-2 rounded-lg">
                      <div className="flex-1 text-xs font-medium font-mono text-slate-700 truncate" title={term.english}>{term.english}</div>
                      <div className="text-slate-300">➔</div>
                      <div className="flex-1 text-xs font-semibold text-slate-800 truncate" title={term.uzbek}>{term.uzbek}</div>
                      <button
                        type="button"
                        onClick={() => {
                          setGlossaryTerms((prev) => prev.filter((t) => t.id !== term.id));
                        }}
                        className="text-slate-400 hover:text-red-500 p-1 transition cursor-pointer"
                        title="Atamani o'chirish"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {glossaryTerms.length === 0 && (
                    <div className="text-center py-4 text-slate-400 text-[11px]">
                      Hozircha maxsus atamalar mavjud emas. Quyidan yangi atama qo'shing.
                    </div>
                  )}
                </div>

                {/* Form to add single glossary term */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <input
                      type="text"
                      id="new-term-eng"
                      placeholder="Inglizcha so'z"
                      className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-400 focus:bg-white transition bg-slate-50 font-medium"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const engInput = e.currentTarget;
                          const uzbInput = document.getElementById("new-term-uzb") as HTMLInputElement;
                          if (engInput.value.trim() && uzbInput.value.trim()) {
                            setGlossaryTerms(prev => [
                              ...prev,
                              { id: Math.random().toString(), english: engInput.value.trim(), uzbek: uzbInput.value.trim() }
                            ]);
                            engInput.value = "";
                            uzbInput.value = "";
                            engInput.focus();
                          }
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center space-x-1">
                    <input
                      type="text"
                      id="new-term-uzb"
                      placeholder="O'zbekcha tarjimasi"
                      className="w-full flex-1 text-xs p-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-400 focus:bg-white transition bg-slate-50 font-medium"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const uzbInput = e.currentTarget;
                          const engInput = document.getElementById("new-term-eng") as HTMLInputElement;
                          if (engInput.value.trim() && uzbInput.value.trim()) {
                            setGlossaryTerms(prev => [
                              ...prev,
                              { id: Math.random().toString(), english: engInput.value.trim(), uzbek: uzbInput.value.trim() }
                            ]);
                            engInput.value = "";
                            uzbInput.value = "";
                            engInput.focus();
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const engVal = (document.getElementById("new-term-eng") as HTMLInputElement).value;
                        const uzbVal = (document.getElementById("new-term-uzb") as HTMLInputElement).value;
                        if (engVal.trim() && uzbVal.trim()) {
                          setGlossaryTerms(prev => [
                            ...prev,
                            { id: Math.random().toString(), english: engVal.trim(), uzbek: uzbVal.trim() }
                          ]);
                          (document.getElementById("new-term-eng") as HTMLInputElement).value = "";
                          (document.getElementById("new-term-uzb") as HTMLInputElement).value = "";
                          (document.getElementById("new-term-eng") as HTMLInputElement).focus();
                        }
                      }}
                      className="p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition cursor-pointer flex items-center justify-center shrink-0"
                      title="Qo'shish"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400">
                  Maslahat: Atama yozib, [Enter] ni bossangiz ham ro'yxatga qo'shiladi.
                </p>
              </div>

              {/* Advanced Custom prompts instructions input drawer */}
              <div className="border-t border-slate-100 pt-3 flex flex-col space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center space-x-1">
                  <Settings className="w-3.5 h-3.5" />
                  <span>Qo'shimcha boshqa ko'rsatmalar</span>
                </label>
                <textarea
                  rows={2}
                  className="w-full text-xs font-mono p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-slate-400 focus:bg-white transition"
                  placeholder="Masalan: Maxfiy kodli so'zlarni tarjima qilma..."
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                />
              </div>
            </div>

            {/* Action Trigger Button banner */}
            <div className="pt-2">
              <button
                id="btn-translate-action"
                type="button"
                onClick={translateText}
                disabled={isLoading || !sourceText.trim()}
                className={`w-full py-4 px-6 rounded-2xl font-bold font-display shadow-md hover:shadow-lg transition-all text-center flex items-center justify-center space-x-3 cursor-pointer ${
                  !sourceText.trim() 
                    ? "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none" 
                    : theme.gradient ? `bg-gradient-to-r ${theme.gradient} text-white` : theme.primary
                }`}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Ishlamoqda...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 animate-pulse" />
                    <span className="tracking-wide">O'zbek Tiliga Tarjima Qilish ({selectedStyle})</span>
                  </>
                )}
              </button>
            </div>

            {/* Error Message display block */}
            <AnimatePresence>
              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-start space-x-3 shadow-xs"
                >
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold font-display text-red-900">Xatolik kutilmoqda</h4>
                    <p className="text-xs mt-1 text-red-800 leading-relaxed">{errorMessage}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>

          {/* Right Panel: Natija / Translation Result */}
          <div className="flex flex-col space-y-4">
            
            {/* Loading Cover (Only during translation) */}
            <AnimatePresence mode="wait">
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 flex flex-col items-center justify-center min-h-[480px] text-center space-y-6"
                >
                  <div className="relative">
                    {/* Ring animated glows */}
                    <div className={`absolute -inset-4 rounded-full bg-gradient-to-r ${theme.gradient} opacity-20 blur-xl animate-pulse-glow`} />
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-tr ${theme.gradient} text-white flex items-center justify-center shadow-lg relative`}>
                      <Languages className="w-8 h-8 animate-bounce" />
                    </div>
                  </div>

                  <div className="space-y-2 max-w-sm">
                    <h3 className="text-md font-bold font-display text-slate-800">Tarjima ishkalanmoqda</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Uzbek tili lug'atlari, qiyosiy grammatika qoidalari va maxsus uslub mezonlari yuklanib tuzilmoqda.
                    </p>
                  </div>

                  {/* Active step progress indicator */}
                  <div className="w-full max-w-xs space-y-2 text-center">
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        className={`h-full bg-gradient-to-r ${theme.gradient || "from-teal-500 to-emerald-500"}`}
                        initial={{ width: "10%" }}
                        animate={{ 
                          width: `${((loadingStep + 1) / LOADING_STEPS.length) * 100}%` 
                        }}
                        transition={{ duration: 1 }}
                      />
                    </div>
                    <p className="text-xs font-mono font-bold text-slate-600 animate-pulse">
                      {LOADING_STEPS[loadingStep]}
                    </p>
                  </div>

                  {/* Multi-chunk progress overlay builder */}
                  {totalChunks > 1 && (
                    <div className="w-full max-w-xs bg-indigo-50/75 border border-indigo-100/80 rounded-xl p-3.5 space-y-2 text-center">
                      <div className="flex items-center justify-between text-[11px] font-bold text-indigo-700">
                        <span>Hujjat tarjimasi jarayoni</span>
                        <span>{translatingChunkIndex} / {totalChunks}-qism ({Math.round(((translatingChunkIndex) / totalChunks) * 100)}%)</span>
                      </div>
                      <div className="h-2 w-full bg-indigo-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-600 rounded-full transition-all duration-300" 
                          style={{ width: `${(translatingChunkIndex / totalChunks) * 100}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        Katta matnlar Gemini quvvati yordamida uzilib qolmasligi uchun bo'laklab o'giriladi va avtomatik birlashtiriladi.
                      </p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Standard Output (Ready or Placeholders) */}
              {!isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[480px] print:border-none print:shadow-none"
                >
                  
                  {/* Output Header Panel */}
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 print:hidden">
                    <div className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">O'zbekcha Tarjima (Natija)</span>
                    </div>

                    {/* Output action buttons */}
                    {translatedText && (
                      <div className="flex items-center space-x-1 sm:space-x-2">
                        {/* Print */}
                        <button
                          id="btn-print-output"
                          type="button"
                          onClick={handlePrint}
                          title="Chop etish yoki PDF yuklab olish"
                          className="p-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>

                        {/* Edit Button */}
                        <button
                          id="btn-edit-toggle"
                          type="button"
                          onClick={() => setIsEditing(!isEditing)}
                          title={isEditing ? "Tahrirni saqlash" : "Natijani qayta tahrirlash"}
                          className={`p-1.5 rounded-md border text-xs font-semibold flex items-center space-x-1 cursor-pointer ${
                            isEditing 
                              ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                              : "border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {isEditing ? <Save className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                          <span className="hidden sm:inline">{isEditing ? "Saqlash" : "Tahrir qilish"}</span>
                        </button>

                        {/* Copy translation */}
                        <button
                          id="btn-copy-output"
                          type="button"
                          onClick={handleCopy}
                          className="p-1.5 rounded-md bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-100 text-indigo-700 text-xs font-semibold flex items-center space-x-1 cursor-pointer transition"
                        >
                          {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{isCopied ? "Nusxalandi!" : "Nusxa olish"}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Body Content / Viewer */}
                  <div className="flex-1 p-6 relative flex flex-col min-h-[360px] print:p-0">
                    
                    {!translatedText ? (
                      /* Empty state helper card */
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-slate-50/20">
                        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4 border border-slate-200/50">
                          <Languages className="w-8 h-8" />
                        </div>
                        <h4 className="text-slate-800 font-bold font-display text-sm tracking-tight">O'zbek tili tarjima oynasi</h4>
                        <p className="text-slate-400 text-xs max-w-xs mt-1 leading-relaxed">
                          Inglizcha matn kiritib "O'zbek Tiliga Tarjima Qilish" tugmasini bosing yoki demo shablon yuklang.
                        </p>
                        
                        <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-sm">
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">Kontekst tahlili</span>
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">Idiomaviy moslashuv</span>
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">Stuktura saqlanishi</span>
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">Quruq kalkasiz tarjima</span>
                        </div>
                      </div>
                    ) : (
                      /* Main output wrapper */
                      <div className="w-full h-full flex flex-col">
                        
                        {isEditing ? (
                          /* Interactive post-editing stage */
                          <textarea
                            id="edited-translation-input"
                            className="w-full flex-1 p-4 text-sm font-mono border border-indigo-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-indigo-300 min-h-[300px] leading-relaxed resize-y bg-slate-50/50"
                            value={editedTranslation}
                            onChange={(e) => setEditedTranslation(e.target.value)}
                          />
                        ) : (
                          /* High-fidelity rendered markdown */
                          <div id="rendered-output-markdown" className="prose prose-slate max-w-none text-slate-800 text-sm leading-relaxed prose-sm flex-1 break-words prose-headings:font-display prose-headings:font-bold prose-headings:tracking-tight prose-a:text-indigo-600">
                            <Markdown>{translatedText}</Markdown>
                          </div>
                        )}

                        {/* Active footer toolbar (non printable) */}
                        <div className="mt-8 border-t border-slate-100 pt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs print:hidden">
                          <div className="text-slate-400 font-medium self-center">
                            <span>Sinflash uslubi: <strong>{selectedStyle}</strong></span>
                            <span className="mx-2 text-slate-200">|</span>
                            <span>Tarjimadagi so'zlar: <strong className="text-slate-600">{targetWordCount}</strong></span>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Download Word DOC */}
                            <button
                              id="btn-download-doc"
                              type="button"
                              onClick={() => downloadFile("doc")}
                              className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 px-2.5 py-1.5 rounded-lg flex items-center space-x-1.5 font-semibold cursor-pointer transition"
                            >
                              <FileDown className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                              <span>Word (.doc) yuklash</span>
                            </button>

                            {/* Download Markdown */}
                            <button
                              id="btn-download-md"
                              type="button"
                              onClick={() => downloadFile("md")}
                              className="bg-slate-100 hover:bg-slate-200/80 border border-slate-200/60 text-slate-700 px-2.5 py-1.5 rounded-lg flex items-center space-x-1.5 font-semibold cursor-pointer transition"
                            >
                              <FileDown className="w-3.5 h-3.5" />
                              <span>Markdown (.md) yuklash</span>
                            </button>

                            {/* Download TXT */}
                            <button
                              id="btn-download-txt"
                              type="button"
                              onClick={() => downloadFile("txt")}
                              className="bg-slate-100 hover:bg-slate-200/80 border border-slate-200/60 text-slate-700 px-2.5 py-1.5 rounded-lg flex items-center space-x-1.5 font-semibold cursor-pointer transition"
                            >
                              <FileDown className="w-3.5 h-3.5 opacity-70" />
                              <span>TXT yuklash</span>
                            </button>
                          </div>
                        </div>

                      </div>
                    )}

                  </div>

                </motion.div>
              )}
            </AnimatePresence>

          </div>

        </div>

        {/* Translation Guarantee/Explanation footer card (Non-printable) */}
        <footer className="bg-slate-200/40 rounded-2xl border border-slate-200/50 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-slate-500 leading-relaxed print:hidden">
          <div className="space-y-1">
            <h5 className="font-bold text-slate-700 flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span>O'zbekiston Milliy Tarjima Va Grammatika Standartlari</span>
            </h5>
            <p>
              Tizim o'zbek tili morfemikasi, punktuatsiyasi va turli kasbiy tarmoqlar uslubiy me'yorlariga rioya etadi.
              Word yoki PDF qilganda sarlavha va shakllar to'liq muvozanatlashgan holda qaytadi.
            </p>
          </div>
          <div className="shrink-0 flex items-center space-x-2">
            <span className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 font-semibold text-slate-600 block">Kalkasiz Muqobil Tarjima</span>
          </div>
        </footer>

      </main>

      {/* Styled Printable Output (Visible only during browser print) */}
      <div className="hidden print:block p-8 bg-white text-black min-h-screen">
        <div className="border-b border-black pb-4 mb-6">
          <h1 className="text-2xl font-bold font-display">O'ZBEK TILI PROFESSIONAL TARJIMASI</h1>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>Uslub: {selectedStyle}</span>
            <span>Sana: {new Date().toLocaleDateString("uz-UZ")}</span>
            {fileName && <span>Asil fayl: {fileName}</span>}
          </div>
        </div>
        <div className="prose prose-slate max-w-none text-sm break-words">
          <Markdown>{isEditing ? editedTranslation : translatedText}</Markdown>
        </div>
        <div className="mt-12 pt-4 border-t border-gray-200 text-center text-[10px] text-gray-400">
          Ushbu hujjat Gemini AI yordamida o'zbek tiliga professional o'girildi. Izoh: kalkaprekladisiz, kontekst saqlangan.
        </div>
      </div>

    </div>
  );
}
