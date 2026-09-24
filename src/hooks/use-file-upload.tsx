import { useState, useRef, useEffect, useCallback, ChangeEvent } from "react";
import { toast } from "sonner";
import {
  AttachmentRef,
  isSupportedAttachment,
  SUPPORTED_ATTACHMENT_EXTENSIONS,
} from "@/lib/attachments";

interface UseFileUploadOptions {
  apiUrl: string;
  initialAttachments?: AttachmentRef[];
}

/** `POST {apiUrl}/files` -- deepagent-aegra's upload/download HTTP app
 * (deepagent-aegra/docs/adr/0004). Returns the `{key, filename}` Attachment
 * pointer; never the file's bytes. */
async function uploadFile(apiUrl: string, file: File): Promise<AttachmentRef> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`${apiUrl}/files`, { method: "POST", body });
  if (!res.ok) {
    throw new Error(`Upload failed for "${file.name}" (${res.status})`);
  }
  const { key } = (await res.json()) as { key: string };
  return { key, filename: file.name };
}

export function useFileUpload({
  apiUrl,
  initialAttachments = [],
}: UseFileUploadOptions) {
  const [attachments, setAttachments] =
    useState<AttachmentRef[]>(initialAttachments);
  const [uploading, setUploading] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const dragCounter = useRef(0);

  const isDuplicate = (file: File, existing: AttachmentRef[]) =>
    existing.some((a) => a.filename === file.name);

  /** Validates, uploads, and appends `files` -- shared by file-input change,
   * drop, and paste. Each accepted file becomes a real `POST /files` call;
   * nothing here base64-encodes a file into chat content. */
  const ingestFiles = useCallback(
    async (files: File[]) => {
      const supportedFiles = files.filter((file) =>
        isSupportedAttachment(file.name),
      );
      const unsupportedFiles = files.filter(
        (file) => !isSupportedAttachment(file.name),
      );
      const duplicateFiles = supportedFiles.filter((file) =>
        isDuplicate(file, attachments),
      );
      const uniqueFiles = supportedFiles.filter(
        (file) => !isDuplicate(file, attachments),
      );

      if (unsupportedFiles.length > 0) {
        toast.error(
          `Unsupported file type(s): ${unsupportedFiles.map((f) => f.name).join(", ")}. Supported: ${SUPPORTED_ATTACHMENT_EXTENSIONS.join(", ")}.`,
        );
      }
      if (duplicateFiles.length > 0) {
        toast.error(
          `Duplicate file(s) detected: ${duplicateFiles.map((f) => f.name).join(", ")}. Each file can only be attached once per message.`,
        );
      }
      if (uniqueFiles.length === 0) return;

      setUploading(true);
      try {
        const results = await Promise.allSettled(
          uniqueFiles.map((file) => uploadFile(apiUrl, file)),
        );
        const uploaded: AttachmentRef[] = [];
        const failed: string[] = [];
        results.forEach((result, idx) => {
          if (result.status === "fulfilled") {
            uploaded.push(result.value);
          } else {
            failed.push(uniqueFiles[idx].name);
            console.error(
              `Attachment upload failed for "${uniqueFiles[idx].name}":`,
              result.reason,
            );
          }
        });
        if (failed.length > 0) {
          toast.error(`Failed to upload: ${failed.join(", ")}.`);
        }
        if (uploaded.length > 0) {
          setAttachments((prev) => [...prev, ...uploaded]);
        }
      } finally {
        setUploading(false);
      }
    },
    [apiUrl, attachments],
  );

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    await ingestFiles(Array.from(files));
    e.target.value = "";
  };

  // Drag and drop handlers
  useEffect(() => {
    if (!dropRef.current) return;

    // Global drag events with counter for robust dragOver state
    const handleWindowDragEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        dragCounter.current += 1;
        setDragOver(true);
      }
    };
    const handleWindowDragLeave = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        dragCounter.current -= 1;
        if (dragCounter.current <= 0) {
          setDragOver(false);
          dragCounter.current = 0;
        }
      }
    };
    const handleWindowDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setDragOver(false);

      if (!e.dataTransfer) return;
      await ingestFiles(Array.from(e.dataTransfer.files));
    };
    const handleWindowDragEnd = () => {
      dragCounter.current = 0;
      setDragOver(false);
    };
    window.addEventListener("dragenter", handleWindowDragEnter);
    window.addEventListener("dragleave", handleWindowDragLeave);
    window.addEventListener("drop", handleWindowDrop);
    window.addEventListener("dragend", handleWindowDragEnd);

    // Prevent default browser behavior for dragover globally
    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("dragover", handleWindowDragOver);

    // Remove element-specific drop event (handled globally)
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(true);
    };
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(true);
    };
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
    };
    const element = dropRef.current;
    element.addEventListener("dragover", handleDragOver);
    element.addEventListener("dragenter", handleDragEnter);
    element.addEventListener("dragleave", handleDragLeave);

    return () => {
      element.removeEventListener("dragover", handleDragOver);
      element.removeEventListener("dragenter", handleDragEnter);
      element.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragenter", handleWindowDragEnter);
      window.removeEventListener("dragleave", handleWindowDragLeave);
      window.removeEventListener("drop", handleWindowDrop);
      window.removeEventListener("dragend", handleWindowDragEnd);
      window.removeEventListener("dragover", handleWindowDragOver);
      dragCounter.current = 0;
    };
  }, [ingestFiles]);

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const resetAttachments = () => setAttachments([]);

  /** Handle paste event for files, so a copied file can be attached the
   * same way a drag-and-drop or file-picker selection is. */
  const handlePaste = async (
    e: React.ClipboardEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    const items = e.clipboardData.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length === 0) return;
    e.preventDefault();
    await ingestFiles(files);
  };

  return {
    attachments,
    setAttachments,
    handleFileUpload,
    dropRef,
    removeAttachment,
    resetAttachments,
    dragOver,
    handlePaste,
    uploading,
  };
}
