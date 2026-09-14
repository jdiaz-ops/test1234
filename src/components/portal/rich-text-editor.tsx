"use client";

import { useCallback, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import Youtube from "@tiptap/extension-youtube";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";

/// Editor de texto enriquecido para la Descripción de producto — mismo
/// menú de opciones que ofrece Shopify (negrita/cursiva/subrayado, color,
/// alineación, listas, link, imagen, video, tabla, ver código). Ver
/// captura de referencia compartida en la conversación del 2026-09-14.
/// El HTML que produce se sanea en el servidor antes de guardarse (ver
/// sanitizeProductDescription) — acá no hace falta duplicar esa lógica,
/// solo evitar que se guarde markup roto.

const COLOR_SWATCHES = [
  "#2e1f22", // brand-ink
  "#d1477b", // brand-accent
  "#8c6f74", // brand-ink-soft
  "#b91c1c", // rojo
  "#1d4ed8", // azul
  "#15803d", // verde
];

function ToolbarButton({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`w-7 h-7 flex items-center justify-center rounded-md text-sm shrink-0 disabled:opacity-30 ${
        active
          ? "bg-brand-accent text-white"
          : "text-brand-ink hover:bg-brand-accent-soft"
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarSeparator() {
  return <span className="w-px h-5 bg-brand-line mx-0.5 shrink-0" />;
}

function AlignIcon({ dir }: { dir: "left" | "center" | "right" }) {
  const lines =
    dir === "left"
      ? ["0,0 14,0", "0,4 10,4", "0,8 14,8", "0,12 10,12"]
      : dir === "center"
        ? ["0,0 14,0", "2,4 12,4", "0,8 14,8", "2,12 12,12"]
        : ["0,0 14,0", "4,4 14,4", "0,8 14,8", "4,12 14,12"];
  return (
    <svg width="14" height="13" viewBox="0 0 14 13" fill="none">
      {lines.map((pts, i) => {
        const [[x1, y1], [x2, y2]] = pts.split(" ").map((p) => p.split(",").map(Number)) as [
          [number, number],
          [number, number],
        ];
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

function ColorPicker({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const current = editor.getAttributes("textStyle").color as string | undefined;

  return (
    <div className="relative">
      <ToolbarButton
        label="Color del texto"
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className="w-3.5 h-3.5 rounded-full border border-brand-line"
          style={{ backgroundColor: current ?? "#2e1f22" }}
        />
      </ToolbarButton>
      {open && (
        <div className="absolute z-10 top-8 left-0 bg-brand-surface border border-brand-line rounded-lg shadow-md p-2 flex items-center gap-1.5">
          {COLOR_SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                editor.chain().focus().setColor(c).run();
                setOpen(false);
              }}
              aria-label={c}
              className="w-5 h-5 rounded-full border border-brand-line"
              style={{ backgroundColor: c }}
            />
          ))}
          <input
            type="color"
            onChange={(e) => {
              editor.chain().focus().setColor(e.target.value).run();
            }}
            className="w-5 h-5 rounded-full border border-brand-line cursor-pointer bg-transparent p-0"
            aria-label="Color personalizado"
          />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editor.chain().focus().unsetColor().run();
              setOpen(false);
            }}
            className="text-[10px] text-brand-ink-soft hover:text-brand-ink px-1"
          >
            Quitar
          </button>
        </div>
      )}
    </div>
  );
}

function LinkButton({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const active = editor.isActive("link");

  function openPopover() {
    setUrl((editor.getAttributes("link").href as string) ?? "");
    setOpen(true);
  }

  function apply() {
    if (!url.trim()) {
      editor.chain().focus().unsetLink().run();
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url.trim() })
        .run();
    }
    setOpen(false);
  }

  return (
    <div className="relative">
      <ToolbarButton label="Enlace" active={active} onClick={openPopover}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path
            d="M9 15l6-6M10 6l1-1a4 4 0 015.7 5.7l-1.4 1.4M14 18l-1 1a4 4 0 01-5.7-5.7l1.4-1.4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </ToolbarButton>
      {open && (
        <div className="absolute z-10 top-8 left-0 bg-brand-surface border border-brand-line rounded-lg shadow-md p-2 flex items-center gap-1.5 w-64">
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                apply();
              }
            }}
            placeholder="https://..."
            className="input text-xs py-1"
          />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={apply}
            className="text-[10px] font-medium text-brand-accent shrink-0"
          >
            OK
          </button>
        </div>
      )}
    </div>
  );
}

function VideoButton({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  function apply() {
    if (url.trim()) {
      editor.chain().focus().setYoutubeVideo({ src: url.trim() }).run();
    }
    setUrl("");
    setOpen(false);
  }

  return (
    <div className="relative">
      <ToolbarButton label="Insertar video de YouTube" onClick={() => setOpen((v) => !v)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="5" width="20" height="14" rx="3" stroke="currentColor" strokeWidth="2" />
          <path d="M10 9l6 3-6 3V9z" fill="currentColor" />
        </svg>
      </ToolbarButton>
      {open && (
        <div className="absolute z-10 top-8 left-0 bg-brand-surface border border-brand-line rounded-lg shadow-md p-2 flex items-center gap-1.5 w-72">
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                apply();
              }
            }}
            placeholder="Link de YouTube"
            className="input text-xs py-1"
          />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={apply}
            className="text-[10px] font-medium text-brand-accent shrink-0"
          >
            OK
          </button>
        </div>
      )}
    </div>
  );
}

function ImageButton({ editor }: { editor: Editor }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/marca/tienda/productos/imagen", {
        method: "POST",
        body: form,
      });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.url) {
        editor.chain().focus().setImage({ src: body.url }).run();
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <ToolbarButton
        label="Insertar imagen"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
          <circle cx="8.5" cy="9.5" r="1.5" fill="currentColor" />
          <path d="M21 16l-5.5-5.5L9 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </ToolbarButton>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => handleFile(e.target.files?.[0])}
        className="hidden"
      />
    </>
  );
}

export function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const [codeView, setCodeView] = useState(false);
  const [rawHtml, setRawHtml] = useState(value);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
        },
      }),
      TextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image,
      Youtube.configure({ nocookie: true, width: 480, height: 270 }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value,
    editorProps: {
      attributes: {
        class:
          "rich-text-content min-h-32 max-h-96 overflow-y-auto px-3 py-2 text-sm text-brand-ink focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html === "<p></p>" ? "" : html);
    },
  });

  const toggleCodeView = useCallback(() => {
    if (!editor) return;
    if (!codeView) {
      setRawHtml(editor.getHTML());
      setCodeView(true);
    } else {
      editor.commands.setContent(rawHtml);
      onChange(editor.getHTML() === "<p></p>" ? "" : editor.getHTML());
      setCodeView(false);
    }
  }, [codeView, editor, rawHtml, onChange]);

  if (!editor) {
    return <div className="input min-h-32" />;
  }

  return (
    <div className="rounded-lg border border-brand-line bg-brand-surface overflow-hidden">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-brand-line bg-brand-bg px-2 py-1.5">
        <ToolbarButton
          label="Negrita"
          active={editor.isActive("bold")}
          disabled={codeView}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <span className="font-bold">B</span>
        </ToolbarButton>
        <ToolbarButton
          label="Cursiva"
          active={editor.isActive("italic")}
          disabled={codeView}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <span className="italic">I</span>
        </ToolbarButton>
        <ToolbarButton
          label="Subrayado"
          active={editor.isActive("underline")}
          disabled={codeView}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <span className="underline">U</span>
        </ToolbarButton>
        {!codeView && <ColorPicker editor={editor} />}

        <ToolbarSeparator />

        <ToolbarButton
          label="Alinear a la izquierda"
          active={editor.isActive({ textAlign: "left" })}
          disabled={codeView}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          <AlignIcon dir="left" />
        </ToolbarButton>
        <ToolbarButton
          label="Centrar"
          active={editor.isActive({ textAlign: "center" })}
          disabled={codeView}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          <AlignIcon dir="center" />
        </ToolbarButton>
        <ToolbarButton
          label="Alinear a la derecha"
          active={editor.isActive({ textAlign: "right" })}
          disabled={codeView}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          <AlignIcon dir="right" />
        </ToolbarButton>

        <ToolbarSeparator />

        <ToolbarButton
          label="Lista con viñetas"
          active={editor.isActive("bulletList")}
          disabled={codeView}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="4" cy="6" r="1.5" fill="currentColor" />
            <circle cx="4" cy="12" r="1.5" fill="currentColor" />
            <circle cx="4" cy="18" r="1.5" fill="currentColor" />
            <line x1="9" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="9" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="9" y1="18" x2="21" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          label="Lista numerada"
          active={editor.isActive("orderedList")}
          disabled={codeView}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <text x="0" y="8" fontSize="7" fill="currentColor">1</text>
            <text x="0" y="14" fontSize="7" fill="currentColor">2</text>
            <text x="0" y="20" fontSize="7" fill="currentColor">3</text>
            <line x1="9" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="9" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="9" y1="18" x2="21" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </ToolbarButton>

        <ToolbarSeparator />

        {!codeView && <LinkButton editor={editor} />}
        {!codeView && <ImageButton editor={editor} />}
        {!codeView && <VideoButton editor={editor} />}
        <ToolbarButton
          label="Insertar tabla"
          disabled={codeView}
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="4" width="18" height="16" rx="1.5" stroke="currentColor" strokeWidth="2" />
            <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="1.6" />
            <line x1="3" y1="16" x2="21" y2="16" stroke="currentColor" strokeWidth="1.6" />
            <line x1="10" y1="4" x2="10" y2="20" stroke="currentColor" strokeWidth="1.6" />
            <line x1="17" y1="4" x2="17" y2="20" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </ToolbarButton>

        <div className="flex-1" />

        <ToolbarButton
          label={codeView ? "Volver al editor" : "Ver código HTML"}
          active={codeView}
          onClick={toggleCodeView}
        >
          <span className="font-mono text-[11px]">{"</>"}</span>
        </ToolbarButton>
      </div>

      {editor.isActive("table") && !codeView && (
        <div className="flex flex-wrap items-center gap-1 border-b border-brand-line px-2 py-1 text-[10px] text-brand-ink-soft">
          <span className="mr-1">Tabla:</span>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().addRowAfter().run()} className="hover:text-brand-accent">+ fila</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().deleteRow().run()} className="hover:text-brand-accent">− fila</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().addColumnAfter().run()} className="hover:text-brand-accent">+ columna</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().deleteColumn().run()} className="hover:text-brand-accent">− columna</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().deleteTable().run()} className="hover:text-red-600">Quitar tabla</button>
        </div>
      )}

      {codeView ? (
        <textarea
          value={rawHtml}
          onChange={(e) => setRawHtml(e.target.value)}
          className="w-full min-h-32 max-h-96 px-3 py-2 text-xs font-mono text-brand-ink focus:outline-none resize-y"
          spellCheck={false}
        />
      ) : (
        <EditorContent editor={editor} />
      )}
    </div>
  );
}
