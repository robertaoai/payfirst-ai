"use client";

import { useState } from "react";
import * as pdfjsLib from "pdfjs-dist";

// Ensure worker is configured for PDF parsing
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface FolderPickerProps {
  onFileLoaded: (fileName: string, content: string) => void;
  onError: (error: string) => void;
}

export function FolderPicker({ onFileLoaded, onError }: FolderPickerProps) {
  const [files, setFiles] = useState<{ handle: any; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleLinkFolder = async () => {
    try {
      if (!("showDirectoryPicker" in window)) {
        onError("Your browser does not support folder selection. Please use Chrome, Edge, or Brave.");
        return;
      }

      setIsLoading(true);
      const dirHandle = await (window as any).showDirectoryPicker();
      const validFiles: { handle: any; name: string }[] = [];

      // Iterate through the directory manually (no subfolders per constraints)
      for await (const entry of dirHandle.values()) {
        if (entry.kind === "file") {
          const lowerName = entry.name.toLowerCase();
          if (lowerName.endsWith(".txt") || lowerName.endsWith(".pdf")) {
            validFiles.push(entry);
          }
        }
      }

      setFiles(validFiles);
      if (validFiles.length === 0) {
        onError("No .txt or .pdf files found in this folder.");
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Folder picker error:", err);
        onError("Failed to access folder.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectFile = async (fileHandle: any) => {
    try {
      setIsLoading(true);
      const file = await fileHandle.getFile();
      let content = "";

      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          content += textContent.items.map((item: any) => item.str).join(" ") + "\n";
        }
      } else {
        content = await file.text();
      }

      onFileLoaded(file.name, content);
    } catch (err) {
      console.error("File parse error:", err);
      onError("Failed to read the selected file.");
    } finally {
      setIsLoading(false);
    }
  };

  if (files.length > 0) {
    return (
      <div className="border-2 border-emerald-500/30 bg-emerald-500/5 rounded-2xl p-6 text-left">
        <h3 className="text-lg font-medium text-white mb-2">Select exactly one file to summarize</h3>
        <p className="text-sm text-neutral-400 mb-4">Found {files.length} document(s) in the linked folder.</p>
        
        <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
          {files.map((f, i) => (
            <button
              key={i}
              onClick={() => handleSelectFile(f.handle)}
              disabled={isLoading}
              className="w-full text-left flex items-center justify-between p-3 rounded-xl bg-neutral-900 border border-white/10 hover:border-emerald-500/50 hover:bg-neutral-800 transition-colors group disabled:opacity-50 disabled:cursor-wait"
            >
              <div className="flex items-center gap-3 truncate">
                <span className="text-xl">{f.name.endsWith(".pdf") ? "📕" : "📄"}</span>
                <span className="text-sm font-medium text-neutral-200 truncate">{f.name}</span>
              </div>
              <span className="text-xs font-semibold text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity">
                Select
              </span>
            </button>
          ))}
        </div>
        
        <button
          onClick={() => setFiles([])}
          className="mt-4 text-xs text-neutral-500 hover:text-white transition-colors"
        >
          Cancel & choose a different folder
        </button>
      </div>
    );
  }

  return (
    <div className="border-2 border-dashed border-neutral-700 hover:border-indigo-500/50 rounded-2xl p-10 text-center transition-colors">
      <div className="space-y-4">
        <div className="text-4xl">📁</div>
        <div>
          <h3 className="text-lg font-medium text-white">Link a folder</h3>
          <p className="text-sm text-neutral-400 mt-1">Select a local folder to quickly pick documents.</p>
        </div>
        <button
          onClick={handleLinkFolder}
          disabled={isLoading}
          className="inline-block mt-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-6 py-2 rounded-full text-sm font-medium hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
        >
          {isLoading ? "Loading..." : "Select Folder"}
        </button>
      </div>
    </div>
  );
}
