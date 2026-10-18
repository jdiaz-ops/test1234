import { describe, expect, it } from "vitest";
import { downloadName, driveFolderId, isReadableDriveEntry, parseEmbeddedFolder } from "@/lib/drive-folder";

describe("carpeta pública de Google Drive", () => {
  it("saca el id de la carpeta de cualquier forma del link", () => {
    expect(driveFolderId("https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp?usp=sharing")).toBe("1AbCdEfGhIjKlMnOp");
    expect(driveFolderId("https://drive.google.com/drive/u/0/folders/1AbCdEfGhIjKlMnOp")).toBe("1AbCdEfGhIjKlMnOp");
    expect(driveFolderId("https://drive.google.com/open?id=1AbCdEfGhIjKlMnOp")).toBe("1AbCdEfGhIjKlMnOp");
    expect(driveFolderId("https://otro-sitio.com/folders/1AbCdEfGhIjKlMnOp")).toBeNull();
  });

  it("lee los archivos, documentos y subcarpetas de la vista simple", () => {
    const html = `
      <div class="flip-entry" id="entry-1FileAAAAAAAA"><a href="https://drive.google.com/file/d/1FileAAAAAAAA/view?usp=drive_web" target="_blank"><div class="flip-entry-info"><div class="flip-entry-title">Catálogo 2026.pdf</div></div></a></div>
      <div class="flip-entry"><a href="https://drive.google.com/drive/folders/1FolderBBBBBBB"><div class="flip-entry-title">Fotos</div></a></div>
      <div class="flip-entry"><a href="https://docs.google.com/spreadsheets/d/1SheetCCCCCCC/edit?usp=drive_web"><div class="flip-entry-title">Precios</div></a></div>
      <div class="flip-entry"><a href="https://drive.google.com/file/d/1VideoDDDDDDD/view"><div class="flip-entry-title">video.mp4</div></a></div>`;
    const entries = parseEmbeddedFolder(html);
    expect(entries).toEqual([
      { id: "1FileAAAAAAAA", name: "Catálogo 2026.pdf", kind: "file" },
      { id: "1FolderBBBBBBB", name: "Fotos", kind: "folder" },
      { id: "1SheetCCCCCCC", name: "Precios", kind: "sheet" },
      { id: "1VideoDDDDDDD", name: "video.mp4", kind: "file" },
    ]);
    expect(entries.filter(isReadableDriveEntry).map((e) => e.name)).toEqual(["Catálogo 2026.pdf", "Fotos", "Precios"]);
    expect(downloadName(entries[2])).toBe("Precios.xlsx");
  });
});
