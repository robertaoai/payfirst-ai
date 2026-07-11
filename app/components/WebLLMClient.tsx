"use client";

import { useState, useRef, useEffect } from "react";
import * as webllm from "@mlc-ai/web-llm";
import * as pdfjsLib from "pdfjs-dist";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/client";
import { FolderPicker, FolderScanResult } from "./FolderPicker";

let hasCompletedFirstStall = false;

// Need to specify the worker src for PDF.js to work client-side.
// We'll use the CDN link that matches the installed version.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const MODEL_ID = process.env.NEXT_PUBLIC_WEBLLM_MODEL_ID || "Qwen2-0.5B-Instruct-q4f16_1-MLC";
const CONTEXT_WINDOW_SIZE = parseInt(process.env.NEXT_PUBLIC_WEBLLM_CONTEXT_WINDOW || "1024", 10);
const MAX_PROMPT_CHARS = parseInt(process.env.NEXT_PUBLIC_WEBLLM_MAX_PROMPT_CHARS || "1500", 10);

type AppState = "init" | "loading_model" | "empty_drop" | "file_loaded" | "summarizing" | "summary_ready" | "error";

// Singleton engine to survive React re-renders and strict mode without WebGPU context loss
let globalEngine: webllm.MLCEngine | null = null;
let globalInitPromise: Promise<void> | null = null;

export default function WebLLMClient({ session_id }: { session_id: string }) {
  const [state, setState] = useState<AppState>("init");
  const [progressText, setProgressText] = useState("");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [summary, setSummary] = useState("");
  const [copied, setCopied] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [totalDuration, setTotalDuration] = useState<number | null>(null);
  const [isFolderPickerEnabled, setIsFolderPickerEnabled] = useState(false);
  const [aiBriefcaseEnabled, setAiBriefcaseEnabled] = useState(false);
  const [folderAgentEnabled, setFolderAgentEnabled] = useState(false);
  const [scanResult, setScanResult] = useState<FolderScanResult | null>(null);
  const [pickerKey, setPickerKey] = useState(0);
  const [activeTab, setActiveTab] = useState<"payfirst-ai" | "briefcase-ai">("payfirst-ai");
  
  // Briefcase UI State
  const [briefcaseState, setBriefcaseState] = useState<"idle" | "running" | "canceling">("idle");
  const [briefcaseTask, setBriefcaseTask] = useState("");
  const [briefcaseHandlePermission, setBriefcaseHandlePermission] = useState<"unknown" | "readonly" | "readwrite">("unknown");
  const briefcaseAbortRef = useRef<AbortController | null>(null);

  const engineRef = useRef<webllm.MLCEngine | null>(null);
  const startTimeRef = useRef<number>(0);

  // Timer for the pre-filling phase (before first token is generated)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (state === "summarizing" && summary === "") {
      interval = setInterval(() => {
        setTimeElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      setTimeElapsed(0);
    }
    return () => clearInterval(interval);
  }, [state, summary]);

  // Check Handle permission for Briefcase AI
  useEffect(() => {
    async function checkPermission() {
      if (!scanResult || !scanResult.dirHandle) {
        setBriefcaseHandlePermission("unknown");
        return;
      }
      try {
        const perm = await scanResult.dirHandle.queryPermission({ mode: "readwrite" });
        setBriefcaseHandlePermission(perm === "granted" ? "readwrite" : "readonly");
      } catch (err) {
        setBriefcaseHandlePermission("readonly");
      }
    }
    checkPermission();
  }, [scanResult, activeTab]);

  // H6 Status Freshness: Re-read status.json when briefcase-ai is activated
  useEffect(() => {
    async function readStatusFresh() {
      if (activeTab === "briefcase-ai" && scanResult?.dirHandle) {
        try {
          const handle = await scanResult.dirHandle.getFileHandle("status.json");
          const file = await handle.getFile();
          const text = await file.text();
          setScanResult(prev => prev ? { ...prev, statusJson: JSON.parse(text), statusJsonError: undefined } : null);
        } catch (err) {
          // If it doesn't exist or is malformed, update state
          setScanResult(prev => prev ? { ...prev, statusJson: null, statusJsonError: "existing status.json couldn't be read, starting fresh" } : null);
        }
      }
    }
    readStatusFresh();
  }, [activeTab, scanResult?.dirHandle]);

  // Initialize on mount
  useEffect(() => {
    let isMounted = true;

    async function fetchFlags() {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("feature_flags")
          .select("feature_name, is_enabled");
          
        if (isMounted && data) {
          const folderPicker = data.find(f => f.feature_name === "folder_link_file_selector");
          if (folderPicker?.is_enabled) setIsFolderPickerEnabled(true);
          
          const briefcase = data.find(f => f.feature_name === "ai_briefcase_pipeline");
          if (briefcase?.is_enabled) setAiBriefcaseEnabled(true);
          
          const agent = data.find(f => f.feature_name === "folder_agent_pipeline");
          if (agent?.is_enabled) setFolderAgentEnabled(true);
        }
      } catch (err) {
        // Silent fail for flag fetching
      }
    }
    fetchFlags();

    async function doInit() {
      // If already initialized globally, just use it
      if (globalEngine) {
        engineRef.current = globalEngine;
        setState("empty_drop");
        return;
      }

      setState("loading_model");
      
      try {
        if (!navigator.gpu) {
          throw new Error("Your browser does not support WebGPU.");
        }

        const initProgressCallback = (report: webllm.InitProgressReport) => {
          if (isMounted) {
            setProgressText(report.text);
            setProgress(report.progress * 100);
          }
        };

        if (!globalInitPromise) {
          globalEngine = new webllm.MLCEngine();
          globalEngine.setInitProgressCallback(initProgressCallback);
          // Limit context window based on env variable to prevent GPU OOM on Windows
          globalInitPromise = globalEngine.reload(MODEL_ID, { context_window_size: CONTEXT_WINDOW_SIZE });
        } else if (globalEngine) {
          globalEngine.setInitProgressCallback(initProgressCallback);
        }

        await globalInitPromise;
        
        if (isMounted && globalEngine) {
          engineRef.current = globalEngine;
          setState("empty_drop");
        }
      } catch (err: any) {
        if (isMounted) {
          console.error("WebLLM Error:", err);
          setState("error");
          setErrorMsg(err.message || "Failed to initialize WebLLM.");
        }
        globalInitPromise = null;
        globalEngine = null;
      }
    }

    doInit();

    return () => {
      isMounted = false;
      // We purposefully DO NOT unload the engine here. 
      // Keeping it as a global singleton prevents "Object has already been disposed"
      // errors caused by React StrictMode double-unmounting or fast refresh.
    };
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    
    if (file.type === "application/pdf") {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(" ");
          fullText += pageText + "\n";
        }
        setFileContent(fullText);
        setState("file_loaded");
      } catch (err) {
        console.error("PDF Parsing error:", err);
        setErrorMsg("Failed to parse PDF file.");
        setState("error");
      }
    } else if (file.type === "text/plain") {
      const text = await file.text();
      setFileContent(text);
      setState("file_loaded");
    } else {
      setErrorMsg("Unsupported file type. Please upload a PDF or TXT file.");
      setState("error");
    }
  };

  const handleFolderFileLoaded = (name: string, content: string) => {
    setFileName(name);
    setFileContent(content);
    setState("file_loaded");
  };

  const handleSummarize = async () => {
    if (!engineRef.current || !fileContent) return;
    
    setState("summarizing");
    setSummary("");
    setTotalDuration(null);
    startTimeRef.current = Date.now();

    try {
      const systemPrompt = "You are a professional assistant. Summarize the following document concisely. Capture the main points, key decisions, and takeaways.";
      // We limit to MAX_PROMPT_CHARS to absolutely ensure the Windows GPU TDR 
      // (Timeout Detection and Recovery) limit of 2 seconds is never reached on slow GPUs.
      const messages: webllm.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Here is the document to summarize:\n\n${fileContent.substring(0, MAX_PROMPT_CHARS)}` }
      ];

      // Step 9: 15-second stall on FIRST spin-up only
      if (!hasCompletedFirstStall) {
         hasCompletedFirstStall = true;
         await new Promise(resolve => setTimeout(resolve, 15000));
      }

      // Simulate slow inference for now (to be replaced in Step 7)
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const completion = await engineRef.current.chat.completions.create({
        messages,
        stream: true,
      });

      let fullSummary = "";
      for await (const chunk of completion) {
        const text = chunk.choices[0]?.delta.content || "";
        fullSummary += text;
        setSummary(fullSummary);
      }
      
      setState("summary_ready");

      // Track activity anonymously
      const duration_seconds = Math.round((Date.now() - startTimeRef.current) / 1000);
      setTotalDuration(duration_seconds);
      const word_count = fileContent.split(/\s+/).length;
      
      fetch("/api/track/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id, word_count, duration_seconds }),
      }).catch(err => console.error("Failed to track activity", err));

    } catch (err: any) {
      console.error("Inference Error:", err);
      let errMsg = err.message || "Failed to generate summary.";
      
      // Handle WebGPU Device Lost / Hung errors gracefully
      if (errMsg.includes("disposed") || errMsg.includes("Device was lost")) {
        errMsg = "Your graphics card timed out or ran out of memory (WebGPU Device Lost). We've reduced the document size to prevent this. Please refresh the page to reset your GPU and try again.";
        // Reset global engine so a refresh guarantees a fresh start
        globalEngine = null;
        globalInitPromise = null;
      }
      
      setErrorMsg(errMsg);
      setState("error");
    }
  };

  const handleReset = () => {
    setState("empty_drop");
    setFileContent("");
    setFileName("");
    setSummary("");
    setTotalDuration(null);
    setScanResult(null);
    setPickerKey(prev => prev + 1);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (state === "init" || state === "loading_model") {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-6">
        <div className="w-16 h-16 rounded-full border-4 border-neutral-800 border-t-emerald-500 animate-spin" />
        <div className="text-center space-y-2">
          <h2 className="text-xl font-medium text-white">Loading Local AI Engine</h2>
          <p className="text-sm text-neutral-400">Downloading Model (only happens once)</p>
        </div>
        <div className="w-full max-w-md bg-neutral-900 rounded-full h-3 overflow-hidden border border-white/5">
          <div 
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-neutral-500 font-mono">{progressText}</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center space-y-4">
        <div className="text-red-400 text-4xl mb-2">⚠️</div>
        <h2 className="text-lg font-medium text-red-400">Initialization Failed</h2>
        <p className="text-sm text-neutral-300">{errorMsg}</p>
        {!navigator.gpu && (
          <div className="mt-4 p-3 bg-neutral-900 rounded text-xs text-neutral-400">
            Your GPU doesn&apos;t support on-device AI. Minimum: WebGPU-enabled browser + 6 GB VRAM recommended.
          </div>
        )}
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-md text-sm transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-8">
      {/* Navigation Sidebar */}
      {((aiBriefcaseEnabled && isFolderPickerEnabled) || folderAgentEnabled) && (
        <div className="w-full md:w-64 shrink-0 flex flex-col gap-2">
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2 px-3">Pipelines</h2>
          <button 
            onClick={() => setActiveTab("payfirst-ai")}
            disabled={state === "summarizing" || briefcaseState !== "idle"}
            className={`text-left px-4 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${activeTab === "payfirst-ai" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "text-neutral-400 hover:bg-white/5"}`}
          >
            payfirst-ai
          </button>
          {(aiBriefcaseEnabled && isFolderPickerEnabled) && (
            <button 
              onClick={() => setActiveTab("briefcase-ai")}
              disabled={state === "summarizing" || briefcaseState !== "idle"}
              className={`text-left px-4 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${activeTab === "briefcase-ai" ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" : "text-neutral-400 hover:bg-white/5"}`}
            >
              briefcase-ai
            </button>
          )}
        </div>
      )}

      {/* Main Content Area (Overlay lock if briefcase is running) */}
      <div className="flex-1 min-w-0 relative">
        
        {briefcaseState === "running" && (
           <div className="absolute inset-0 z-50 bg-[#0a0a1a]/80 backdrop-blur-sm rounded-2xl flex items-center justify-center">
             <div className="bg-neutral-900 border border-neutral-700 p-6 rounded-xl flex flex-col items-center gap-4 text-center max-w-sm mx-4">
                <span className="w-8 h-8 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
                <div>
                   <h3 className="font-bold text-white mb-1">
                     Processing Folder...
                   </h3>
                   <p className="text-sm text-neutral-400">
                     Generating Briefcase rules. Please do not close the tab.
                   </p>
                </div>
                <button
                  onClick={() => briefcaseAbortRef.current?.abort()}
                  className="mt-2 bg-neutral-800 hover:bg-neutral-700 text-white px-6 py-2 rounded-xl font-medium transition-colors border border-white/10 text-sm"
                >
                  Cancel
                </button>
             </div>
           </div>
        )}

        {/* payfirst-ai Pipeline (HIDDEN when inactive, but remains mounted to preserve state) */}
        <div className={`space-y-6 ${activeTab !== "payfirst-ai" ? "hidden" : "block"}`}>
          
          {(state !== "empty_drop" || scanResult !== null) && (
            <div className="flex justify-end mb-2">
              <button 
                onClick={handleReset}
                disabled={state === "summarizing"}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-colors border flex items-center gap-2 shadow-lg ${
                  state === "summarizing"
                    ? "bg-neutral-800 text-neutral-500 border-white/5 cursor-not-allowed"
                    : "bg-neutral-800 hover:bg-neutral-700 text-white border-white/10"
                }`}
              >
                🔄 Start Over
              </button>
            </div>
          )}

          <div className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors
            ${state === "empty_drop" ? "border-neutral-700 hover:border-emerald-500/50" : "border-emerald-500/30 bg-emerald-500/5"}`}>
            
            {state === "empty_drop" && (
          <div className="space-y-4 w-full">
            <div className="text-4xl">📄</div>
            <div>
              <h3 className="text-lg font-medium text-white">Drop a document to summarize</h3>
              <p className="text-sm text-neutral-400 mt-1">Supports PDF and TXT. Processed 100% locally.</p>
            </div>
            <label className="inline-block mt-2 cursor-pointer bg-white text-black px-6 py-2 rounded-full text-sm font-medium hover:bg-neutral-200 transition-colors">
              Choose File
              <input type="file" accept=".pdf,.txt" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        )}

        {state === "empty_drop" && isFolderPickerEnabled && (
          <>
            <div className="w-full flex items-center gap-4 my-6 opacity-30">
              <div className="flex-1 h-[1px] bg-white"></div>
              <span className="text-xs font-medium uppercase tracking-widest text-white">OR</span>
              <div className="flex-1 h-[1px] bg-white"></div>
            </div>
            <div className="w-full">
              <FolderPicker 
                key={pickerKey}
                onFileLoaded={handleFolderFileLoaded} 
                onFolderScanned={(result) => {
                   setScanResult(result);
                   if (result.statusJsonError) {
                      setErrorMsg(result.statusJsonError);
                   }
                }}
                onError={(msg) => {
                  setErrorMsg(msg);
                  setState("error");
                }} 
              />
            </div>
          </>
        )}

        {(state === "file_loaded" || state === "summarizing" || state === "summary_ready") && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-left">
              <div className="text-2xl">📄</div>
              <div>
                <p className="font-medium text-white truncate max-w-[200px] md:max-w-md">{fileName}</p>
                <p className="text-xs text-emerald-400 mt-0.5">Loaded securely into memory</p>
              </div>
            </div>
            
            {state === "file_loaded" && (
              <button 
                onClick={handleSummarize}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-full text-sm font-medium transition-colors shadow-[0_0_15px_rgba(16,185,129,0.3)]"
              >
                Summarize Now
              </button>
            )}

            {state === "summarizing" && (
              <div className="flex items-center gap-2 text-emerald-400 text-sm">
                <span className="w-4 h-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                Processing... {summary === "" && `(${timeElapsed}s)`}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Output Panel */}
      {(state === "summarizing" || state === "summary_ready") && (
        <div className="bg-[#12121a] border border-white/10 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
            <h3 className="font-medium text-white flex items-center gap-2">
              ✨ Executive Summary
              {totalDuration !== null && (
                <span className="text-xs text-emerald-400 font-normal ml-2 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  Completed in {totalDuration}s
                </span>
              )}
            </h3>
            {state === "summary_ready" && (
              <button 
                onClick={copyToClipboard}
                className="text-xs flex items-center gap-1.5 text-neutral-400 hover:text-white transition-colors"
              >
                {copied ? "✓ Copied" : "📋 Copy to clipboard"}
              </button>
            )}
          </div>
          <div className="prose prose-invert max-w-none text-neutral-300 leading-relaxed min-h-[150px]">
            {summary ? (
              <ReactMarkdown>{summary}</ReactMarkdown>
            ) : (
              <div className="flex flex-col gap-2 text-neutral-600 animate-pulse">
                <span>Reading document...</span>
                <span className="text-sm">This usually takes 10-30 seconds on the first run depending on your device. ({timeElapsed}s elapsed)</span>
              </div>
            )}
          </div>
        </div>
      )}
      </div>

      {/* briefcase-ai Pipeline */}
      {aiBriefcaseEnabled && (
        <div className={`space-y-6 w-full ${activeTab !== "briefcase-ai" ? "hidden" : "block"}`}>
          <div className="bg-[#12121a] border border-white/10 rounded-2xl p-8 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-3xl">💼</span>
              <h2 className="text-2xl font-bold text-white">Briefcase AI</h2>
            </div>
            
            {!scanResult ? (
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-8 text-center">
                <p className="text-neutral-400 mb-4">You need to link a folder first.</p>
                <button 
                  onClick={() => setActiveTab("payfirst-ai")}
                  className="bg-indigo-500/20 text-indigo-300 px-6 py-2 rounded-full hover:bg-indigo-500/30 transition-colors"
                >
                  Link a folder in payfirst-ai first
                </button>
              </div>
            ) : briefcaseHandlePermission === "readonly" ? (
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-8 text-center">
                <p className="text-neutral-400 mb-4">Briefcase AI needs write access to save its configuration to your folder.</p>
                <button 
                  onClick={async () => {
                     try {
                        const status = await scanResult.dirHandle.requestPermission({ mode: "readwrite" });
                        if (status === "granted") {
                           setBriefcaseHandlePermission("readwrite");
                        } else {
                           setErrorMsg("Permission denied. Briefcase AI requires write access to proceed.");
                        }
                     } catch (err) {
                        console.error("Permission request failed", err);
                        setErrorMsg("Failed to request folder permission.");
                     }
                  }}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-2 rounded-full font-medium transition-colors"
                >
                  Grant folder access
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-indigo-300">Folder Linked</h3>
                    <p className="text-sm text-indigo-400/70">{scanResult.dirHandle.name}</p>
                  </div>
                  <span className="text-xs bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full border border-indigo-500/30">
                    {scanResult.statusJson ? "Scan Only" : "Clean Setup"}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-xl">
                    <h4 className="font-medium text-neutral-300 mb-4 flex items-center gap-2">
                      <span className="text-sm">📁</span> Base Directory
                    </h4>
                    <ul className="space-y-3">
                      {["CLAUDE.md", "AGENT.md", "TASK.md"].map(file => (
                        <li key={file} className="flex items-center gap-3">
                          <span className="text-xl">
                            {(scanResult.conventionFiles.base as any)[file] ? "✅" : "❌"}
                          </span>
                          <span className={`font-mono text-sm ${(scanResult.conventionFiles.base as any)[file] ? "text-emerald-400" : "text-neutral-500"}`}>
                            {file}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-xl">
                    <h4 className="font-medium text-neutral-300 mb-4 flex items-center gap-2">
                      <span className="text-sm">📂</span> Subfolders (1-level deep)
                    </h4>
                    <ul className="space-y-3">
                      {["agent.md", "task.md"].map(file => (
                        <li key={file} className="flex items-center gap-3">
                          <span className="text-xl">
                            {(scanResult.conventionFiles.subfolders as any)[file] ? "✅" : "❌"}
                          </span>
                          <span className={`font-mono text-sm ${(scanResult.conventionFiles.subfolders as any)[file] ? "text-emerald-400" : "text-neutral-500"}`}>
                            {file}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {scanResult.statusJsonError && (
                   <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-xl text-orange-400 text-sm">
                      ⚠️ {scanResult.statusJsonError}
                   </div>
                )}

                {scanResult.statusJson && !scanResult.statusJsonError && (
                  <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-xl">
                    <h4 className="font-medium text-neutral-300 mb-2">status.json</h4>
                    <pre className="text-xs text-neutral-400 overflow-x-auto p-4 bg-black/50 rounded-lg border border-white/5">
                      {JSON.stringify(scanResult.statusJson, null, 2)}
                    </pre>
                  </div>
                )}
                
                {/* Task Input */}
                <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-xl">
                  <h4 className="font-medium text-neutral-300 mb-2">Task Description</h4>
                  <textarea 
                    value={briefcaseTask}
                    onChange={(e) => setBriefcaseTask(e.target.value)}
                    placeholder="Describe what you want to build..."
                    className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-indigo-500/50 resize-y min-h-[80px]"
                  />
                </div>

                {/* Concurrency UI Actions */}
                <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                  <button 
                    onClick={async () => {
                      if (!globalEngine) return;
                      setBriefcaseState("running");
                      briefcaseAbortRef.current = new AbortController();
                      const signal = briefcaseAbortRef.current.signal;
                      
                      try {
                        const stallPromise = (async () => {
                           if (!hasCompletedFirstStall) {
                              hasCompletedFirstStall = true;
                              await new Promise(r => setTimeout(r, 15000));
                           }
                        })();

                        const generatePromise = (async () => {
                           await stallPromise;
                           let text = "Mocked generated output text for task: " + briefcaseTask;
                           for (let i = 0; i < 5; i++) {
                             await new Promise(r => setTimeout(r, 1000));
                           }
                           return text;
                        })();

                        const abortPromise = new Promise<never>((_, reject) => {
                           signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
                        });

                        const generatedText = await Promise.race([generatePromise, abortPromise]);
                        
                        const dirHandle = scanResult.dirHandle;
                        let outputDirHandle: any = null;
                        let fallbackDownload = false;

                        // 1. Get or create output/ directory
                        try {
                           outputDirHandle = await dirHandle.getDirectoryHandle("output", { create: true });
                        } catch (err: any) {
                           if (err.name === "TypeMismatchError") {
                              fallbackDownload = true;
                              setErrorMsg("File saved to your downloads. Folder write failed, so the next step isn't available for this run.");
                           } else {
                              setErrorMsg("Failed to create output directory: " + err.message);
                              return; // Stop on unexpected error
                           }
                        }

                        // 2. Write Output
                        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
                        const outFilename = `result-${timestamp}.md`;

                        if (fallbackDownload) {
                           const blob = new Blob([generatedText], { type: 'text/markdown' });
                           const url = URL.createObjectURL(blob);
                           const a = document.createElement("a");
                           a.href = url;
                           a.download = outFilename;
                           a.click();
                           URL.revokeObjectURL(url);
                           // status.json write stays incomplete, Briefcase stays disabled
                        } else {
                           // Pre-write existence check (required for templates, shown here for output too)
                           let exists = false;
                           try {
                             await outputDirHandle.getFileHandle(outFilename);
                             exists = true;
                           } catch (e: any) {
                             if (e.name !== "NotFoundError") throw e;
                           }

                           if (exists) {
                             setErrorMsg(`File ${outFilename} already exists. Write skipped.`);
                           } else {
                             // Atomic write
                             const fileHandle = await outputDirHandle.getFileHandle(outFilename, { create: true });
                             const writable = await fileHandle.createWritable();
                             try {
                               if (signal.aborted) {
                                 await writable.abort();
                                 throw new DOMException("Aborted", "AbortError");
                               }
                               await writable.write(generatedText);
                               await writable.close();
                             } catch (writeErr) {
                               await writable.abort();
                               throw writeErr;
                             }
                           }

                           // 3. Write status.json
                           try {
                              const statusHandle = await dirHandle.getFileHandle("status.json", { create: true });
                              const writable = await statusHandle.createWritable();
                              try {
                                 if (signal.aborted) {
                                   await writable.abort();
                                   throw new DOMException("Aborted", "AbortError");
                                 }
                                 const newStatus = {
                                   step: "Setup Complete",
                                   last_completed: timestamp,
                                   convention_files: scanResult.conventionFiles
                                 };
                                 await writable.write(JSON.stringify(newStatus, null, 2));
                                 await writable.close();
                                 // Update state to trigger re-render
                                 setScanResult({ ...scanResult, statusJson: newStatus });
                              } catch (writeErr) {
                                 await writable.abort();
                                 throw writeErr;
                              }
                           } catch (err: any) {
                              if (err.name !== "AbortError") {
                                 setErrorMsg("Failed to write status.json. Output was saved, but pipeline status is incomplete.");
                              } else {
                                 throw err;
                              }
                           }
                        }
                      } catch (err: any) {
                        if (err.name === "AbortError") {
                           console.log("Setup Cancelled");
                        }
                      } finally {
                        if (briefcaseAbortRef.current?.signal.aborted) {
                           // Force reload engine to clear aborted state
                           try { await globalEngine.reload(MODEL_ID, { context_window_size: CONTEXT_WINDOW_SIZE }); } catch(e) {}
                        }
                        setBriefcaseState("idle");
                        briefcaseAbortRef.current = null;
                      }
                    }}
                    disabled={state === "processing" || state === "summarizing" || briefcaseState !== "idle" || briefcaseTask.trim() === ""}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    🚀 Setup Briefcase
                  </button>
                </div>

              </div>
            )}
          </div>
        </div>
      )}
      
      </div>
    </div>
  );
}
