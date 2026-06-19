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
  const [selectedModel, setSelectedModel] = useState<string>("gemini-3.1-flash-lite");
  
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
  const [apiKey, setApiKeyState] = useState<string>(() => {
    try {
      return (typeof window !== "undefined" && window.localStorage)
        ? window.localStorage.getItem("user_gemini_api_key") || ""
        : "";
    } catch {
      return "";
    }
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
          primary: "bg-[#FF6D29] hover:bg-[#e0581b] text-white",
          accent: "text-[#FF6D29]",
          bgLight: "bg-[#453027]/40",
          border: "border-[#453027]/80 focus:border-[#FF6D29] focus:ring-[#FF6D29]/20",
          accentBg: "bg-[#453027] text-[#FF6D29]",
          gradient: "from-[#FF6D29] to-[#453027]",
          gradientLight: "from-[#453027]/10 to-[#161316]/80",
          tagBg: "bg-[#453027]/60 border-[#453027]/80 text-[#BABABA]",
          btnOutline: "border-[#453027]/80 text-[#BABABA] hover:bg-[#453027]/30"
        };
      case "Ilmiy":
        return {
          primary: "bg-[#FF6D29] hover:bg-[#e0581b] text-white",
          accent: "text-[#FF6D29]",
          bgLight: "bg-[#453027]/40",
          border: "border-[#453027]/80 focus:border-[#FF6D29] focus:ring-[#FF6D29]/20",
          accentBg: "bg-[#453027] text-[#FF6D29]",
          gradient: "from-[#FF6D29] to-[#453027]",
          gradientLight: "from-[#453027]/10 to-[#161316]/80",
          tagBg: "bg-[#453027]/60 border-[#453027]/80 text-[#BABABA]",
          btnOutline: "border-[#453027]/80 text-[#BABABA] hover:bg-[#453027]/30"
        };
      case "Rasmiy":
      default:
        return {
          primary: "bg-[#FF6D29] hover:bg-[#e0581b] text-white",
          accent: "text-[#FF6D29]",
          bgLight: "bg-[#453027]/40",
          border: "border-[#453027]/80 focus:border-[#FF6D29] focus:ring-[#FF6D29]/20",
          accentBg: "bg-[#453027] text-[#FF6D29]",
          gradient: "from-[#FF6D29] to-[#453027]",
          gradientLight: "from-[#453027]/10 to-[#161316]/80",
          tagBg: "bg-[#453027]/60 border-[#453027]/80 text-[#BABABA]",
          btnOutline: "border-[#453027]/80 text-[#BABABA] hover:bg-[#453027]/30"
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

            const contentType = res.headers.get("content-type");
            if (contentType && contentType.includes("text/html")) {
              throw new Error("Tizim hozirda statik xostingda (masalan, Netlify) ishlamoqda. Netlify faqat static fayllarni o'qiydi va Node.js serverimizni ishga tushirmaydi. Hujjatlarni (PDF/Word) o'girish uchun Google Cloud Run yoki serverli to'liq versiyani ishlating.");
            }

            let data;
            try {
              data = await res.json();
            } catch (jsonErr) {
              throw new Error("Server javobini tahlil qilib bo'lmadi (JSON emas). Netlify kabi statik xizmat orqali yuklangan bo'lishi mumkin.");
            }

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
        
        let chunkResult = "";

        if (apiKey && apiKey.trim() !== "") {
          // --- CLIENT-SIDE DIRECT GEMINI API CALL FOR FREE NETLIFY HOSTER ---
          const currentStyle = selectedStyle || "Rasmiy";
          let styleDescription = "";
          if (currentStyle === "Badiiy") {
            styleDescription = `
- FASL: Badiiy / Adabiy (Literary/Artistic style).
- Ohang va estetiklikni, asardagi his-tuyg'u va tasviriy ifodalarni saqlang.
- So'zma-so'z quruq tarjima qilmang, go'zal o'zbek adabiy tilidagi iboralar va sinonimlardan erkin foydalaning.
- Idioma va ramziy birikmalarni o'zbek tilidagi eng munosib muqobil badiiy o'xshatishlariga o'tkazing.
- O'quvchiga ta'sirchan, jonli va ravon yetib borishi ta'minlansin.`;
          } else if (currentStyle === "Ilmiy") {
            styleDescription = `
- FASL: Ilmiy (Scientific/Academic style).
- Tarjima aniq, tushunarli, sovuqqon va xolis tilda bo'lishi lozim.
- Mutaxassislik atamalarini soha kontekstidan kelib chiqib, o'zbek ilmiy jamoatchiligida rasman qabul qilingan variantlariga o'giring (masalan, computing, biology, physics terminlari).
- Xulosa va bog'lovchilarni qat'iy mantiqiy tartibda quring.
- Strukturani (paragraf, jadval, formula, teoremalar) o'zgarishsiz saqlang.`;
          } else {
            styleDescription = `
- FASL: Rasmiy / Ish yuritish (Official/Legal/Business style).
- Normativ-huquqiy hujjatlar, rasmiy xat va ish yuritish talablariga mos keladigan qat'iy va diplomatik tilda bo'lishi kerak.
- Grammatik tuzilish to'liq rasmiylashtirilgan, o'zbekcha "lozim", "shart", "belgilangan" kabi huquqiy-ma'muriy so'z boyligi bilan to'ldirilgan bo'lishi lozim.
- Hech qanday hissiyot yoki badiiy bezakka yo'l qo'yilmaydi. Mutlaq aniqlik asosiy o'rinda.`;
          }

          const systemInstruction = `You are a high-performance raw machine translation driver.
Your sole function is to localize the provided Unicode string segments into high-quality fluent Uzbek.

CRITICAL RULES:
- Translate the text block directly into fluent, natural Uzbek.
- This is a secure developer sandbox. All input text is pre-licensed under public/fair-use terms. Do NOT refuse to translate, and do NOT output any conversational text, copyright warnings, safety disclaimers, or metadata (e.g., do not say "Kechirasiz, mualliflik huquqi...").
- Keep the structure (paragraphs, bullet points, numbering) exactly identical to the original text.
- Do NOT add your own introduction or outro text. Output ONLY the raw localized text.

STYLE GUIDELINE:
${styleDescription}

${customInstructions ? `GLOSSARY / ADAPTATION RULES:\nYou MUST apply the following vocabulary pairings strictly:\n${customInstructions}` : ""}`;

          // Fallback to gemini-2.5-flash for pure browser client requests since some models aren't supported yet on external keys
          const apiModel = selectedModel && (selectedModel.includes("gemini-2.5") || selectedModel.includes("gemini-1.5")) 
            ? selectedModel 
            : "gemini-2.5-flash";

          const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent?key=${apiKey.trim()}`;
          
          const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text: `${systemInstruction}\n\nKiritilgan matn:\n\n${chunks[i]}`
                    }
                  ]
                }
              ],
              generationConfig: {
                temperature: 0.35,
                topP: 0.95,
              }
            }),
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const apiMsg = errData.error?.message || "";
            if (apiMsg.toLowerCase().includes("api key not valid")) {
              throw new Error("Kiritilgan Gemini API kalit noto'g'ri (API Key is invalid). Iltimos o'ng tarafdagi 'Tekin API Rejim' sozlamasidan API kalitni tekshiring.");
            }
            throw new Error(errData.error?.message || `Google Gemini API tarmog'ida xato yuz berdi (Status ${response.status}).`);
          }

          const resData = await response.json();
          let generated = resData.candidates?.[0]?.content?.parts?.[0]?.text || "";
          
          // Remove potential markdown code blocks if the client output somehow nested it
          if (generated.startsWith("```") && generated.endsWith("```")) {
            // Strip first and last line
            const lines = generated.split("\n");
            if (lines.length > 2) {
              generated = lines.slice(1, lines.length - 1).join("\n");
            }
          }
          chunkResult = generated;
        } else {
          // --- ORDINARY BACKEND EXPRESS SERVER CALL ---
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

          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("text/html")) {
            throw new Error("Tizim hozirda statik xostingda (masalan, Netlify) demo rejimda ishlamoqda. Netlify faqat static fayllarni o'gira oladi va Node.js server drayverlarimizni ishlatmaydi. Talabalar ushbu ajoyib tizimni mutlaqo tekin, cheksiz va xatolarsiz umrbod ishlatishlari uchun o'ng burchakdagi 'Tekin API Rejim' sozlamasidan o'zlarining shaxsiy bepul API kalitlarini kiritib ishlashlari tavsiya etiladi.");
          }

          let data;
          try {
            data = await response.json();
          } catch (jsonErr) {
            throw new Error("Server javobini tahlil qilib bo'lmadi (JSON emas). Netlify kabi statik xosting tufayli API so'rovi qayta yo'naltirilgan bo'lishi mumkin.");
          }

          if (!response.ok) {
            throw new Error(data.error || `Tarjima qilish jarayonida (${i + 1}-qismda) xatolik yuz berdi.`);
          }

          chunkResult = data.translatedText || "";
        }
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
    <div className="min-h-screen bg-[#161316] text-white flex flex-col font-sans relative overflow-x-hidden selection:bg-[#FF6D29]/30 selection:text-[#FF6D29]">
      
      {/* Premium Visual Background Glowing elements */}
      <div className="glowing-bg" />
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#FF6D29] opacity-10 blur-[150px] pointer-events-none animate-pulse-glow" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#453027] opacity-40 blur-[150px] pointer-events-none" />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col space-y-6 relative z-10">
        
        {/* Modern Minimalist Top Bar / Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-6 border-b border-[#453027]/40">
          <div className="flex flex-col">
            <span className="text-[11px] font-sans font-medium tracking-[0.3em] text-[#FF6D29] uppercase">Professional Tarjima Tizimi</span>
            <h1 className="text-3xl font-extrabold tracking-tight text-white font-display mt-1 flex items-center gap-2">
              sardor<span className="font-extralight text-[#BABABA]">tarjimon</span>
              <span className="text-[10px] uppercase tracking-widest font-mono border border-[#FF6D29]/30 text-[#FF6D29] bg-[#FF6D29]/10 px-2.5 py-0.5 rounded-full">pro</span>
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-4 sm:mt-0">
            {/* API Settings Trigger Button */}
            <button
              id="btn-toggle-settings"
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className={`px-4 py-2 border rounded-full text-xs font-semibold tracking-wider transition-all flex items-center gap-2 shadow-sm cursor-pointer ${
                apiKey 
                  ? "border-emerald-500/50 hover:border-emerald-500 bg-emerald-500/10 text-emerald-300" 
                  : "border-[#453027] hover:border-[#FF6D29] hover:text-[#FF6D29] bg-[#1c191c] text-white"
              }`}
              title="Netlify yoki boshqa statik hostingda bepul cheksiz ishlash uchun sozlash"
            >
              <Settings className={`w-3.5 h-3.5 ${apiKey ? "text-emerald-400 animate-spin" : "text-[#FF6D29]"}`} style={{ animationDuration: apiKey ? "10s" : "0s" }} />
              <span>{apiKey ? "API Rejim: Faol" : "Tekin API Rejim"}</span>
            </button>

            {/* History Trigger Button */}
            <button
              id="btn-toggle-history-sidebar"
              type="button"
              onClick={() => setIsHistoryOpen(!isHistoryOpen)}
              className="px-4 py-2 border border-[#453027] hover:border-[#FF6D29] hover:text-[#FF6D29] rounded-full text-xs font-semibold tracking-wider transition-all bg-[#1c191c] text-white flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-[#FF6D29]" />
              <span>Tarix ({historyList.length})</span>
            </button>

            <a 
              href="https://muhammadai.uz" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="px-4 py-2 border border-[#453027] hover:border-[#FF6D29] hover:text-[#FF6D29] rounded-full text-xs transition-all bg-[#161316]/50 shadow-sm font-semibold tracking-wider text-[#BABABA]"
            >
              muhammadai.uz
            </a>
          </div>
        </header>

        {/* History Drawer Sidebar Overlay */}
        <AnimatePresence>
          {isHistoryOpen && (
            <>
              {/* Overlay Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsHistoryOpen(false)}
                className="fixed inset-0 bg-black z-40"
              />
              {/* Sidebar content */}
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 bottom-0 w-full sm:w-[400px] bg-[#1c191c] border-l border-[#453027] z-50 p-6 shadow-2xl flex flex-col"
              >
                <div className="flex items-center justify-between border-b border-[#453027]/40 pb-4 mb-4">
                  <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-[#FF6D29]" />
                    <h3 className="font-bold text-white text-md">Tarjimalar Tarixi</h3>
                  </div>
                  <button
                    onClick={() => setIsHistoryOpen(false)}
                    className="text-[#BABABA] hover:text-white text-xs px-2.5 py-1 rounded-md border border-[#453027]/40 cursor-pointer"
                  >
                    Yopish
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {historyList.length === 0 ? (
                    <div className="text-center py-12 text-[#BABABA]/40 text-xs">
                      Hozircha saqlangan tarjimalar mavjud emas.<br/>Tizimda o'girmalar qilinganda bu yerga avtomatik qo'shiladi.
                    </div>
                  ) : (
                    historyList.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleLoadHistory(item)}
                        className="p-3.5 rounded-xl border border-[#453027]/40 hover:border-[#FF6D29]/40 bg-[#161316]/60 cursor-pointer transition-all hover:bg-[#161316] group relative flex flex-col space-y-1.5 text-left"
                      >
                        <div className="flex items-center justify-between text-[9px] font-mono text-[#BABABA]/40">
                          <span>{item.model?.replace("gemini-", "").toUpperCase() || "GEMINI"} • {item.style.toUpperCase()}</span>
                          <span>{new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <p className="text-xs text-[#BABABA] line-clamp-2 pr-6">{item.sourceText}</p>
                        <p className="text-xs text-[#FF6D29] line-clamp-2 pr-6 font-medium">{item.translatedText}</p>
                        <button
                          onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                          className="absolute right-3 top-3 text-[#BABABA]/30 hover:text-red-400 opacity-0 group-hover:opacity-100 p-1 rounded-md transition-all duration-200 cursor-pointer"
                          title="Tarixdan o'chirish"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {historyList.length > 0 && (
                  <div className="border-t border-[#453027]/40 pt-4 mt-4">
                    <button
                      id="btn-clear-history-action"
                      onClick={handleClearHistory}
                      className="w-full py-2.5 border border-red-500/20 hover:border-red-500/50 text-red-400 hover:bg-red-500/5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer"
                    >
                      Barcha tarixni tozalash
                    </button>
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Style Selection and Quick Features Bar (Useless texts removed completely) */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center justify-between pb-2 border-b border-[#453027]/30">
          
          {/* Tone Selector */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-[#BABABA] uppercase tracking-widest shrink-0">Uslub:</span>
            <div className="flex gap-2">
              {(["Rasmiy", "Ilmiy", "Badiiy"] as StyleType[]).map((style) => (
                <button
                  key={style}
                  id={`btn-style-${style.toLowerCase()}`}
                  type="button"
                  onClick={() => setSelectedStyle(style)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold tracking-wider transition-all border cursor-pointer ${
                    selectedStyle === style
                      ? "bg-[#FF6D29] text-white border-[#FF6D29] shadow-[0_0_15px_rgba(255,109,41,0.25)]"
                      : "bg-[#161316]/70 text-[#BABABA] border-[#453027] hover:border-[#FF6D29]/40 hover:text-white"
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          {/* Model and Demo selector bar combined elegantly */}
          <div className="flex flex-wrap items-center md:justify-end gap-3">
            <div className="flex items-center gap-2 bg-[#453027]/20 border border-[#453027]/50 px-3.5 py-1.5 rounded-full">
              <span className="text-[9px] uppercase font-bold text-[#BABABA] tracking-wider">Model:</span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-transparent text-xs text-[#FF6D29] font-bold focus:outline-hidden border-none pr-1 cursor-pointer"
              >
                <option value="gemini-3.1-flash-lite" className="bg-[#161316] text-[#BABABA]">Gemini 3.1 Lite (Tezkor)</option>
                <option value="gemini-2.5-flash" className="bg-[#161316] text-[#BABABA]">Gemini 2.5 (Aql-zakovat)</option>
                <option value="gemini-3.5-flash" className="bg-[#161316] text-[#BABABA]">Gemini 3.5 (Nozik lison)</option>
              </select>
            </div>

            {/* Quick Demo Dictionaries Selectors */}
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] uppercase font-bold text-[#BABABA]/55 tracking-wider hidden sm:inline">Namunalar:</span>
              {(["Rasmiy", "Ilmiy", "Badiiy"] as StyleType[]).map((style) => (
                <button
                  key={`demo-${style}`}
                  id={`btn-template-${style.toLowerCase()}`}
                  type="button"
                  onClick={() => handleLoadTemplate(style)}
                  className="bg-[#453027]/10 text-[#BABABA] hover:text-white border border-[#453027]/60 hover:border-[#FF6D29]/60 px-3.5 py-1.5 rounded-full cursor-pointer transition-all text-[10px] font-medium"
                  title={`${style} namunaviy matnini yuklash`}
                >
                  + {style}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Workspace Dual-Pane Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          
          {/* Left Panel: Kiritish / Input */}
          <div className="flex flex-col space-y-4 print:hidden">
            <div className="bg-[#1c191c] rounded-2xl border border-[#453027]/60 shadow-[0_4px_25px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col">
              
              <div className="px-5 py-4 border-b border-[#453027]/40 flex items-center justify-between bg-[#453027]/20">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-[#FF6D29] animate-pulse" />
                  <span className="text-xs font-semibold tracking-wider text-[#BABABA] uppercase">Kiritilayotgan Matn</span>
                </div>
                {sourceText && (
                  <button
                    id="btn-clear-source"
                    type="button"
                    onClick={() => {
                      setSourceText("");
                      setFileName(null);
                      setErrorMessage("");
                    }}
                    className="text-[#BABABA]/60 hover:text-[#FF6D29] text-xs flex items-center space-x-1 font-medium transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Tozalash</span>
                  </button>
                )}
              </div>

              {/* Textarea */}
              <div className="relative">
                <textarea
                  id="source-text-input"
                  rows={10}
                  className="w-full p-5 text-white placeholder-[#BABABA]/30 focus:outline-hidden resize-y min-h-[250px] text-sm leading-relaxed border-0 bg-transparent"
                  placeholder="Xorijiy doston yoki rasmiy xatni bu yerga joylang yoki faylni pastga sudrang..."
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  disabled={isFileLoading}
                />

                {/* File Parsing Loading Overlay */}
                {isFileLoading && (
                  <div className="absolute inset-0 bg-[#161316]/95 flex flex-col items-center justify-center space-y-3 z-20">
                    <div className="w-9 h-9 rounded-full border-2 border-dashed border-[#FF6D29] animate-spin" />
                    <div className="text-center">
                      <p className="text-xs font-semibold text-white">Hujjatdan matn o'qilmoqda...</p>
                    </div>
                  </div>
                )}

                {/* Word & Symbol count overlay */}
                <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[10px] text-[#BABABA]/60 pointer-events-none">
                  <div className="flex items-center space-x-3 bg-[#161316]/80 px-2.5 py-1 rounded-md border border-[#453027]/40">
                    <span>So'zlar: <strong className="text-white font-mono">{sourceWordCount}</strong></span>
                    <span className="text-[#453027]">|</span>
                    <span>Belgilar: <strong className="text-white font-mono">{sourceCharCount}</strong></span>
                  </div>
                  {fileName && (
                    <div className="bg-[#453027]/50 border border-[#FF6D29]/20 text-[#FF6D29] px-2 py-0.5 rounded flex items-center space-x-1 font-mono text-[9px]">
                      <FileCheck className="w-3 h-3" />
                      <span>{fileName}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* File Upload / Drag zone */}
              <div 
                className={`border-t border-[#453027]/40 p-4 bg-[#161316]/20 transition-all ${
                  dragActive ? "bg-[#453027]/40" : ""
                }`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
              >
                <div className="border border-dashed border-[#453027] hover:border-[#FF6D29]/50 rounded-xl bg-[#161316]/40 p-3.5 text-center transition cursor-pointer flex flex-col items-center relative group">
                  <input
                    type="file"
                    id="file-upload-input"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={handleFileInput}
                    accept=".txt,.md,.json,.csv,.xml,.html,.pdf,.docx"
                    disabled={isFileLoading}
                  />
                  <UploadCloud className="w-7 h-7 text-[#BABABA]/50 group-hover:text-[#FF6D29] mb-1.5 transition-transform" />
                  <p className="text-xs font-semibold text-white">PDF, Word yoki TXT faylni shu yerga tashlang</p>
                </div>
              </div>

            </div>

            {/* Custom rules/directives Drawer */}
            <div className="bg-[#1c191c]/90 rounded-2xl border border-[#453027]/60 shadow-[0_4px_25px_rgba(0,0,0,0.4)] p-5 flex flex-col space-y-4">
              <div className="flex items-center justify-between border-b border-[#453027]/30 pb-3">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                  <BookMarked className="w-4 h-4 text-[#FF6D29]" />
                  <span>Maxsus Atamalar (Glossary)</span>
                </span>
                <span className="text-[10px] text-[#FF6D29] bg-[#453027]/40 px-2.5 py-0.5 rounded-full font-semibold">Tahrirlash</span>
              </div>

              {/* Glossary Grid Builder */}
              <div className="space-y-3">
                {glossaryTerms.length > 0 && (
                  <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                    {glossaryTerms.map((term) => (
                      <div key={term.id} className="flex items-center space-x-2 bg-[#161316]/80 border border-[#453027]/40 p-2 rounded-lg">
                        <div className="flex-1 text-xs font-mono text-[#BABABA] truncate" title={term.english}>{term.english}</div>
                        <div className="text-[#FF6D29] text-[10px]">➔</div>
                        <div className="flex-1 text-xs font-semibold text-white truncate" title={term.uzbek}>{term.uzbek}</div>
                        <button
                          type="button"
                          onClick={() => {
                            setGlossaryTerms((prev) => prev.filter((t) => t.id !== term.id));
                          }}
                          className="text-[#BABABA]/40 hover:text-red-400 p-1 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Form to add single glossary term */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <input
                    type="text"
                    id="new-term-eng"
                    placeholder="Inglizcha so'z"
                    className="text-xs p-2.5 border border-[#453027] rounded-lg bg-[#161316]/60 text-white placeholder-[#BABABA]/30 focus:outline-[#FF6D29]/50"
                  />
                  <div className="flex items-center space-x-1">
                    <input
                      type="text"
                      id="new-term-uzb"
                      placeholder="O'zbekcha tarjimasi"
                      className="w-full flex-1 text-xs p-2.5 border border-[#453027] bg-[#161316]/60 rounded-lg text-white placeholder-[#BABABA]/30 focus:outline-[#FF6D29]/50"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
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
                        }
                      }}
                      className="p-2.5 rounded-lg bg-[#FF6D29] hover:bg-[#e0581b] text-white transition cursor-pointer flex items-center justify-center shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Advanced Custom prompts instructions input drawer */}
              <div className="border-t border-[#453027]/30 pt-3 flex flex-col space-y-1">
                <textarea
                  rows={2}
                  className="w-full text-xs font-mono p-2.5 bg-[#161316]/80 border border-[#453027] rounded-lg text-white placeholder-[#BABABA]/30 focus:outline-[#FF6D29]/40"
                  placeholder="Model uchun qo'shimcha lisoniy talablar bo'lsa kiriting (ixtiyoriy)..."
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
                className={`w-full py-4 px-6 rounded-2xl font-bold tracking-wider transition-all text-center flex items-center justify-center space-x-3 cursor-pointer ${
                  !sourceText.trim() 
                    ? "bg-[#453027]/20 border border-[#453027]/50 text-[#BABABA]/30 cursor-not-allowed shadow-none" 
                    : "bg-[#FF6D29] hover:bg-[#e0581b] text-white shadow-[0_4px_25px_rgba(255,109,41,0.35)] hover:shadow-[0_4px_35px_rgba(255,109,41,0.5)] active:scale-[0.99]"
                }`}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>O'girilmoqda...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 animate-pulse text-white" />
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
                  className="bg-[#3b1616] border border-red-500/30 text-red-100 p-4 rounded-xl flex items-start space-x-3 shadow-lg"
                >
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-red-200">Tarjima jarayonida xatolik</h4>
                    <p className="text-xs mt-1 text-red-300/85 leading-relaxed">{errorMessage}</p>
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
                  className="bg-[#1c191c]/90 rounded-2xl border border-[#453027]/60 shadow-[0_4px_25px_rgba(0,0,0,0.4)] p-8 flex flex-col items-center justify-center min-h-[480px] text-center space-y-6"
                >
                  <div className="relative">
                    {/* Ring animated glows */}
                    <div className="absolute -inset-4 rounded-full bg-[#FF6D29] opacity-20 blur-xl animate-pulse-glow" />
                    <div className="w-16 h-16 rounded-2xl bg-[#453027]/30 text-[#FF6D29] border border-[#453027] flex items-center justify-center shadow-lg relative">
                      <Languages className="w-8 h-8 animate-bounce" />
                    </div>
                  </div>

                  <div className="space-y-1 max-w-sm">
                    <h3 className="text-md font-bold text-white uppercase tracking-wider">Tarjima qilinmoqda</h3>
                    <p className="text-xs text-[#BABABA]/60 leading-relaxed font-sans">
                      Lisoniy tizim va maxsus uslub doirasida tasniflanmoqda...
                    </p>
                  </div>                  {/* Active step progress indicator */}
                  <div className="w-full max-w-xs space-y-2 text-center">
                    <div className="h-1 w-full bg-[#161316] rounded-full overflow-hidden border border-[#453027]/30">
                      <motion.div 
                        className="h-full bg-[#FF6D29] shadow-[0_0_8px_#FF6D29]"
                        initial={{ width: "10%" }}
                        animate={{ 
                          width: `${((loadingStep + 1) / LOADING_STEPS.length) * 100}%` 
                        }}
                        transition={{ duration: 1 }}
                      />
                    </div>
                    <p className="text-[10px] font-mono font-bold text-[#FF6D29] animate-pulse">
                      {LOADING_STEPS[loadingStep]}
                    </p>
                  </div>

                  {/* Multi-chunk progress overlay builder */}
                  {totalChunks > 1 && (
                    <div className="w-full max-w-xs bg-[#453027]/10 border border-[#453027]/50 rounded-xl p-3.5 space-y-2 text-center">
                      <div className="flex items-center justify-between text-[10px] font-bold text-[#FF6D29]">
                        <span>Hujjat o'girilmoqda</span>
                        <span>{translatingChunkIndex} / {totalChunks}-qism</span>
                      </div>
                      <div className="h-1.5 w-full bg-[#161316] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#FF6D29] rounded-full transition-all duration-300" 
                          style={{ width: `${(translatingChunkIndex / totalChunks) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Standard Output (Ready or Placeholders) */}
              {!isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-[#1c191c]/90 rounded-2xl border border-[#453027]/60 shadow-[0_4px_25px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col min-h-[480px] print:border-none print:shadow-none"
                >
                  
                  {/* Output Header Panel */}
                  <div className="px-5 py-4 border-b border-[#453027]/40 flex items-center justify-between bg-[#453027]/20 print:hidden">
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 bg-[#FF6D29] rounded-full" />
                      <span className="text-xs font-semibold tracking-wider text-[#BABABA] uppercase">O'zbekcha Tarjima</span>
                    </div>                    {/* Output action buttons */}
                    {translatedText && (
                      <div className="flex items-center space-x-1.5">
                        {/* Audio speak */}
                        <button
                          id="btn-speak-output"
                          type="button"
                          onClick={handleSpeak}
                          title={isSpeaking ? "Ovozni to'xtatish" : "Ovozli eshitish (Talaffuz)"}
                          className="p-1.5 rounded-md border border-[#453027] text-[#BABABA] hover:border-[#FF6D29] hover:text-white transition cursor-pointer"
                        >
                          {isSpeaking ? <VolumeX className="w-3.5 h-3.5 text-[#FF6D29] animate-pulse" /> : <Volume2 className="w-3.5 h-3.5" />}
                        </button>

                        {/* Print */}
                        <button
                          id="btn-print-output"
                          type="button"
                          onClick={handlePrint}
                          title="Chop etish"
                          className="p-1.5 rounded-md border border-[#453027] text-[#BABABA] hover:border-[#FF6D29] hover:text-white transition cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>

                        {/* Edit Button */}
                        <button
                          id="btn-edit-toggle"
                          type="button"
                          onClick={() => setIsEditing(!isEditing)}
                          className={`p-1.5 rounded-md border text-xs font-semibold flex items-center space-x-1 cursor-pointer transition ${
                            isEditing 
                              ? "bg-[#FF6D29] border-[#FF6D29] text-white" 
                              : "border-[#453027] text-[#BABABA] hover:border-[#FF6D29] hover:text-white"
                          }`}
                        >
                          {isEditing ? <Save className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                          <span>{isEditing ? "Saqlash" : "Tahrirlash"}</span>
                        </button>

                        {/* Copy translation */}
                        <button
                          id="btn-copy-output"
                          type="button"
                          onClick={handleCopy}
                          className="p-1.5 rounded-md bg-[#FF6D29] hover:bg-[#e0581b] text-white text-xs font-semibold flex items-center space-x-1 cursor-pointer transition"
                        >
                          {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>Nusxa olish</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Body Content / Viewer */}
                  <div className="flex-1 p-6 relative flex flex-col min-h-[360px] print:p-0">
                    
                    {!translatedText ? (
                      /* Empty state helper card */
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-[#161316]/20">
                        <div className="w-12 h-12 rounded-full bg-[#453027]/20 border border-[#453027] flex items-center justify-center text-[#BABABA]/40 mb-4">
                          <Languages className="w-6 h-6" />
                        </div>
                        <h4 className="text-white font-semibold text-xs tracking-wider uppercase">O'zbekcha tarjima oynasi</h4>
                        <p className="text-[#BABABA]/40 text-[11px] max-w-xs mt-1 leading-relaxed">
                          Soddalashtirilgan minimalist visual dizayn. Xorijiy matn kiritgach o'girmalar shu yerda oydinlashadi.
                        </p>
                      </div>
                    ) : (
                      /* Main output wrapper */
                      <div className="w-full h-full flex flex-col">
                        
                        {isEditing ? (
                          /* Interactive post-editing stage */
                          <textarea
                            id="edited-translation-input"
                            className="w-full flex-1 p-4 text-sm font-mono border border-[#453027] rounded-xl focus:outline-none min-h-[300px] leading-relaxed resize-y bg-[#161316] text-white"
                            value={editedTranslation}
                            onChange={(e) => setEditedTranslation(e.target.value)}
                          />
                        ) : (
                          /* High-fidelity rendered markdown */
                          <div id="rendered-output-markdown" className="rendered-markdown text-stone-200 text-sm leading-relaxed flex-1 break-words prose prose-invert max-w-none">
                            <Markdown>{translatedText}</Markdown>
                          </div>
                        )}

                        {/* Active footer toolbar (non printable) */}
                        <div className="mt-8 border-t border-[#453027]/40 pt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-[10px] print:hidden">
                          <div className="text-[#BABABA]/40 font-mono">
                            <span>Soha: <strong className="text-[#BABABA]">{selectedStyle}</strong></span>
                            <span className="mx-2 text-[#453027]">|</span>
                            <span>So'zlar: <strong className="text-[#BABABA]">{targetWordCount}</strong></span>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-1.5">
                            {/* Download Word DOC */}
                            <button
                              id="btn-download-doc"
                              type="button"
                              onClick={() => downloadFile("doc")}
                              className="bg-[#161316] hover:bg-[#453027]/30 border border-[#453027] hover:border-[#FF6D29]/40 text-[#BABABA] hover:text-white px-2.5 py-1.5 rounded-lg flex items-center space-x-1.5 font-semibold cursor-pointer transition"
                            >
                              <FileDown className="w-3.5 h-3.5 text-[#FF6D29]" />
                              <span>Word (.doc) yuklash</span>
                            </button>

                            {/* Download Markdown */}
                            <button
                              id="btn-download-md"
                              type="button"
                              onClick={() => downloadFile("md")}
                              className="bg-[#161316] hover:bg-[#453027]/30 border border-[#453027] hover:border-[#FF6D29]/40 text-[#BABABA] hover:text-white px-2.5 py-1.5 rounded-lg flex items-center space-x-1.5 font-semibold cursor-pointer transition"
                            >
                              <FileDown className="w-3.5 h-3.5" />
                              <span>Markdown</span>
                            </button>

                            {/* Download TXT */}
                            <button
                              id="btn-download-txt"
                              type="button"
                              onClick={() => downloadFile("txt")}
                              className="bg-[#161316] hover:bg-[#453027]/30 border border-[#453027] hover:border-[#FF6D29]/40 text-[#BABABA] hover:text-white px-2.5 py-1.5 rounded-lg flex items-center space-x-1.5 font-semibold cursor-pointer transition"
                            >
                              <FileDown className="w-3.5 h-3.5 opacity-70" />
                              <span>TXT</span>
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
        <footer className="bg-[#1c191c]/40 rounded-2xl border border-[#453027]/30 p-5 flex items-center justify-between gap-4 text-[10px] text-[#BABABA]/40 print:hidden">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-3.5 h-3.5 text-[#FF6D29] shrink-0 animate-pulse" />
            <span>Kalkasiz o'zbek tili tarjima standarti. muhammadai.uz hamkorlik loyihasi.</span>
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

      {/* API Settings Modal Dialog */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            
            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#1c191c] border border-[#453027] rounded-3xl max-w-md w-full p-6 relative z-10 shadow-2xl flex flex-col space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[#453027]/50 pb-3">
                <div className="flex items-center space-x-2.5">
                  <Settings className="w-5 h-5 text-[#FF6D29] animate-spin" style={{ animationDuration: "12s" }} />
                  <h3 className="text-base font-bold text-white tracking-wide">Tekin API Rejim Sozlamalari</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="text-[#BABABA] hover:text-white transition-colors cursor-pointer text-sm font-semibold hover:bg-[#453027]/30 px-2.5 py-1 rounded-lg"
                >
                  Yopish
                </button>
              </div>

              <div className="text-xs text-[#BABABA] leading-relaxed space-y-2">
                <p>
                  Ushbu tizim hozirda statik xostingda (masalan, Netlify) ishlamoqda. Netlify kabi tekin xizmatlar faqat statik sahifalarni qo'llab-quvvatlaydi, Node.js server drayverlarimizni esa ishlata maydi.
                </p>
                <div className="p-3 bg-[#453027]/10 border border-[#453027]/40 rounded-xl space-y-1.5 text-[#BABABA]">
                  <p className="font-bold text-white text-[11px] uppercase tracking-wider text-[#FF6D29]">Talabalar uchun umrbod cheksiz va tekin:</p>
                  <ol className="list-decimal list-inside space-y-1 text-[11px]">
                    <li>Google AI Studio (<a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" className="text-[#FF6D29] underline hover:text-[#e0581b]">aistudio.google.com</a>) saytiga o'ting.</li>
                    <li>O'z Google pochtangiz orqali mutlaqo bepul va tezkor o'z shaxsiy **Gemini API Key (Kalit)** yarating.</li>
                    <li>Olgan kalitingizni quyidagi maydonga kiriting va saqlang!</li>
                  </ol>
                </div>
                <p className="text-[10px] text-[#BABABA]/60 italic">
                  Eslatma: Kalit faqat sizning brauzeringizda (localStorage'da) xavfsiz saqlanadi. Hech qanday serverga yoki uchinchi shaxsga hech qachon yuborilmaydi.
                </p>
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="text-[10px] font-bold text-[#BABABA] uppercase tracking-wider">Gemini API Key (Kalit):</label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="AIzaSy..."
                    value={apiKey}
                    onChange={(e) => {
                      const val = e.target.value;
                      setApiKeyState(val);
                      if (val) {
                        try {
                          safeLocalStorage.setItem("user_gemini_api_key", val);
                        } catch(e){}
                      } else {
                        try {
                          safeLocalStorage.removeItem("user_gemini_api_key");
                        } catch(e){}
                      }
                    }}
                    className="w-full bg-[#161316] border border-[#453027] focus:border-[#FF6D29] rounded-xl px-4 py-3 text-xs text-white placeholder-[#BABABA]/30 outline-none transition-all font-mono"
                  />
                  {apiKey && (
                    <button
                      type="button"
                      onClick={() => {
                        setApiKeyState("");
                        try {
                          safeLocalStorage.removeItem("user_gemini_api_key");
                        } catch(e){}
                      }}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-red-500 hover:text-red-400 transition-colors cursor-pointer font-bold"
                    >
                      O'chirish
                    </button>
                  )}
                </div>
              </div>

              <div className="pt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-[#FF6D29] hover:bg-[#e0581b] text-white text-xs font-bold transition shadow-md hover:shadow-lg active:scale-95 cursor-pointer"
                >
                  Saqlash va Yopish
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
