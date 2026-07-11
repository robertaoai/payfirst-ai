"use client";

import { useState } from "react";
import * as pdfjsLib from "pdfjs-dist";

// Ensure worker is configured for PDF parsing
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export type ConventionFiles = {
  base: {
    "CLAUDE.md": boolean;
    "AGENT.md": boolean;
    "TASK.md": boolean;
  };
  subfolders: {
    "agent.md": boolean;
    "task.md": boolean;
  };
};

export type FolderScanResult = {
  dirHandle: any;
  statusJson: any | null;
  statusJsonError?: string;
  conventionFiles: ConventionFiles;
};

interface FolderPickerProps {
  onFileLoaded: (fileName: string, content: string) => void;
  onError: (error: string) => void;
  onFolderScanned?: (result: FolderScanResult) => void;
  disabled?: boolean;
}

export function FolderPicker({ onFileLoaded, onError, onFolderScanned, disabled }: FolderPickerProps) {
  const [files, setFiles] = useState<{ handle: any; name: string }[]>([]);
  const [dirHandle, setDirHandle] = useState<any>(null);
  const [permissionError, setPermissionError] = useState<{ type: 'initial' | 'revoked', message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLinkFolder = async () => {
    try {
      if (!("showDirectoryPicker" in window)) {
        onError("Your browser does not support folder selection. Please use Chrome, Edge, or Brave.");
        return;
      }

      setIsLoading(true);
      setPermissionError(null);

      let handle = dirHandle;
      
      // If we don't have a handle, or we had an initial denial (meaning no handle was ever granted), ask for one
      if (!handle || permissionError?.type === 'initial') {
        handle = await (window as any).showDirectoryPicker({ mode: "read" });
        setDirHandle(handle);
      }

      // Check permissions for the handle (handles mid-session revocation)
      if ((await handle.queryPermission({ mode: "read" })) !== "granted") {
        const status = await handle.requestPermission({ mode: "read" });
        if (status !== "granted") {
          setPermissionError({ type: 'revoked', message: "Permission to read the folder was revoked. Please grant access to continue." });
          return;
        }
      }

      const validFiles: { handle: any; name: string }[] = [];
      const conventionFiles: ConventionFiles = {
        base: { "CLAUDE.md": false, "AGENT.md": false, "TASK.md": false },
        subfolders: { "agent.md": false, "task.md": false }
      };
      let statusJson: any = null;
      let statusJsonError: string | undefined;

      // Iterate through the directory manually
      for await (const entry of handle.values()) {
        if (entry.name === "output") {
          continue; // Exclude output directory
        }

        if (entry.kind === "file") {
          const name = entry.name;
          const lowerName = name.toLowerCase();
          
          if (lowerName.endsWith(".txt") || lowerName.endsWith(".pdf")) {
            validFiles.push({ handle: entry, name: entry.name });
          }

          if (name === "status.json") {
            try {
              const file = await entry.getFile();
              const text = await file.text();
              statusJson = JSON.parse(text);
            } catch (e) {
              statusJsonError = "existing status.json couldn't be read, starting fresh";
            }
          }

          if (name === "CLAUDE.md" || name === "AGENT.md" || name === "TASK.md") {
            conventionFiles.base[name] = true;
          }
        } else if (entry.kind === "directory") {
          // Scan 1-level deep subfolders for agent.md and task.md
          for await (const subEntry of entry.values()) {
            if (subEntry.kind === "file") {
              const subName = subEntry.name;
              if (subName === "agent.md" || subName === "task.md") {
                conventionFiles.subfolders[subName] = true;
              }
            }
          }
        }
      }

      setFiles(validFiles);
      if (onFolderScanned) {
        onFolderScanned({ dirHandle: handle, statusJson, statusJsonError, conventionFiles });
      }

      if (validFiles.length === 0) {
        onError("No .txt or .pdf files found in this folder.");
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        setPermissionError({ type: 'initial', message: "Folder selection was canceled. You must link a folder to use this feature." });
        setDirHandle(null);
      } else {
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
      <div className={`border-2 border-emerald-500/30 bg-emerald-500/5 rounded-2xl p-6 text-left transition-colors ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
        <h3 className="text-lg font-medium text-white mb-2">Select exactly one file to summarize</h3>
        <p className="text-sm text-neutral-400 mb-4">Found {files.length} document(s) in the linked folder.</p>
        
        <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
          {files.map((f, i) => (
            <button
              key={i}
              onClick={() => handleSelectFile(f.handle)}
              disabled={isLoading || disabled}
              className="w-full text-left flex items-center justify-between p-3 rounded-xl bg-neutral-900 border border-white/10 hover:border-emerald-500/50 hover:bg-neutral-800 transition-colors group disabled:opacity-50 disabled:cursor-wait disabled:hover:border-white/10"
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
      </div>
    );
  }

  if (permissionError) {
    return (
      <div className={`border-2 border-dashed border-red-500/50 hover:border-red-500 rounded-2xl p-10 text-center transition-colors ${disabled ? "opacity-50 pointer-events-none" : "bg-red-500/5"}`}>
        <div className="space-y-4">
          <div className="text-4xl">⚠️</div>
          <div>
            <h3 className="text-lg font-medium text-white">Permission Required</h3>
            <p className="text-sm text-red-400 mt-1 max-w-sm mx-auto">{permissionError.message}</p>
          </div>
          <button
            onClick={handleLinkFolder}
            disabled={isLoading || disabled}
            className="inline-block mt-2 bg-red-500/20 text-red-300 border border-red-500/30 px-6 py-2 rounded-full text-sm font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50"
          >
            {isLoading ? "Loading..." : (permissionError.type === 'initial' ? "Choose Folder Again" : "Grant Permission")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`border-2 border-dashed border-neutral-700 hover:border-indigo-500/50 rounded-2xl p-10 text-center transition-colors ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      <div className="space-y-4">
        <div className="text-4xl">📁</div>
        <div>
          <h3 className="text-lg font-medium text-white">Link a folder</h3>
          <p className="text-sm text-neutral-400 mt-1">Select a local folder to quickly pick documents.</p>
        </div>
        <button
          onClick={handleLinkFolder}
          disabled={isLoading || disabled}
          className="inline-block mt-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-6 py-2 rounded-full text-sm font-medium hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
        >
          {isLoading ? "Loading..." : "Select Folder"}
        </button>
      </div>
    </div>
  );
}
