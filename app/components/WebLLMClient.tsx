"use client";

import { useState, useRef, useEffect } from "react";
import * as webllm from "@mlc-ai/web-llm";
import * as pdfjsLib from "pdfjs-dist";

// Need to specify the worker src for PDF.js to work client-side.
// We'll use the CDN link that matches the installed version.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const MODEL_ID = "Llama-3.1-8B-Instruct-q4f16_1-MLC";

type AppState = "init" | "loading_model" | "empty_drop" | "file_loaded" | "summarizing" | "summary_ready" | "error";

export default function WebLLMClient({ session_id }: { session_id: string }) {
  const [state, setState] = useState<AppState>("init");
  const [progressText, setProgressText] = useState("");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [summary, setSummary] = useState("");
  const [copied, setCopied] = useState(false);
  
  const engineRef = useRef<webllm.MLCEngine | null>(null);
  const startTimeRef = useRef<number>(0);

  // Initialize on mount
  useEffect(() => {
    initModel();
  }, []);

  async function initModel() {
    setState("loading_model");
    try {
      // Check for WebGPU
      if (!navigator.gpu) {
        throw new Error("Your browser does not support WebGPU.");
      }

      const initProgressCallback = (report: webllm.InitProgressReport) => {
        setProgressText(report.text);
        setProgress(report.progress * 100);
      };

      const engine = new webllm.MLCEngine();
      engine.setInitProgressCallback(initProgressCallback);
      
      await engine.reload(MODEL_ID);
      engineRef.current = engine;
      setState("empty_drop");
    } catch (err: any) {
      console.error("WebLLM Error:", err);
      setState("error");
      setErrorMsg(err.message || "Failed to initialize WebLLM.");
    }
  }

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

  const handleSummarize = async () => {
    if (!engineRef.current || !fileContent) return;
    
    setState("summarizing");
    setSummary("");
    startTimeRef.current = Date.now();

    try {
      const systemPrompt = "You are a professional assistant. Summarize the following document concisely. Capture the main points, key decisions, and takeaways.";
      const messages: webllm.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Here is the document to summarize:\n\n${fileContent.substring(0, 15000)}` }
      ];

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
      const word_count = fileContent.split(/\s+/).length;
      
      fetch("/api/track/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id, word_count, duration_seconds }),
      }).catch(err => console.error("Failed to track activity", err));

    } catch (err: any) {
      console.error("Inference Error:", err);
      setErrorMsg(err.message || "Failed to generate summary.");
      setState("error");
    }
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
          <p className="text-sm text-neutral-400">Downloading Llama-3.1 (only happens once)</p>
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
    <div className="space-y-6">
      {/* Upload Zone */}
      <div className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors
        ${state === "empty_drop" ? "border-neutral-700 hover:border-emerald-500/50" : "border-emerald-500/30 bg-emerald-500/5"}`}>
        
        {state === "empty_drop" && (
          <div className="space-y-4">
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
                Processing...
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
            {summary || <span className="text-neutral-600 animate-pulse">Reading document...</span>}
          </div>
        </div>
      )}
    </div>
  );
}
