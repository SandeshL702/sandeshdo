import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { HeaderActions } from "@/components/header-actions";
import { Sheet } from "@/components/sheet";
import { Button, Input } from "@/components/ui";
import { useApp } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Note, NoteColor } from "@/lib/types";

export const Route = createFileRoute("/notes")({ component: NotesPage });

const COLORS: NoteColor[] = ["paper", "teal", "sand", "rose"];

const COLOR_CLASS: Record<NoteColor, string> = {
  paper: "bg-surface text-fg",
  teal: "bg-primary text-primary-fg",
  sand: "bg-elevated text-fg",
  rose: "bg-urgent/15 text-fg",
};

export function NotesPage() {
  const { t } = useT();
  const notes = useApp((s) => s.notes);
  const addNote = useApp((s) => s.addNote);
  const updateNote = useApp((s) => s.updateNote);
  const deleteNote = useApp((s) => s.deleteNote);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [color, setColor] = useState<NoteColor>("paper");
  const sorted = useMemo(
    () => [...notes].sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || b.updatedAt - a.updatedAt),
    [notes],
  );

  const startNew = () => {
    setEditing(null);
    setTitle("");
    setBody("");
    setColor("paper");
    setOpen(true);
  };

  const startEdit = (note: Note) => {
    setEditing(note);
    setTitle(note.title);
    setBody(note.body);
    setColor(note.color);
    setOpen(true);
  };

  const save = () => {
    const tTitle = title.trim() || body.trim().slice(0, 32) || t("notes.add");
    if (editing) updateNote(editing.id, { title: tTitle, body, color });
    else addNote({ title: tTitle, body, color });
    setOpen(false);
  };

  return (
    <main className="overflow-x-hidden px-5 pt-5 pb-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <BrandMark compact />
          <h1 className="font-display mt-3 text-title leading-none font-medium tracking-tight">{t("notes.title")}</h1>
        </div>
        <HeaderActions />
      </div>
      <button
        type="button"
        onClick={startNew}
        className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-semibold text-primary-fg"
      >
        <Plus className="size-4" />
        {t("notes.add")}
      </button>
      {sorted.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted">{t("notes.empty")}</p>
      ) : (
        <div className="mt-4 columns-2 gap-2">
          {sorted.map((note) => (
            <button
              key={note.id}
              type="button"
              onClick={() => startEdit(note)}
              className={cn(
                "mb-2 w-full break-inside-avoid rounded-2xl px-3 py-3 text-left shadow-[var(--sd-card-shadow)]",
                COLOR_CLASS[note.color],
              )}
            >
              <div className="text-sm font-semibold">{note.title}</div>
              {note.body ? <p className="mt-1 line-clamp-6 whitespace-pre-wrap text-xs opacity-80">{note.body}</p> : null}
            </button>
          ))}
        </div>
      )}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? t("notes.title") : t("notes.add")}
        footer={
          <div className="flex gap-2">
            {editing && (
              <Button
                variant="danger"
                className="flex-1"
                onClick={() => {
                  deleteNote(editing.id);
                  setOpen(false);
                }}
              >
                {t("notes.delete")}
              </Button>
            )}
            <Button className="flex-1" onClick={save}>
              {t("notes.save")}
            </Button>
          </div>
        }
      >
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("notes.add")} />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("notes.body")}
          rows={8}
          className="mt-3 w-full resize-none rounded-2xl bg-bg px-3 py-3 text-sm text-fg shadow-[var(--sd-card-shadow)] outline-none"
        />
        <div className="mt-3 flex gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onClick={() => setColor(c)}
              className={cn("size-9 rounded-full", COLOR_CLASS[c], color === c && "ring-2 ring-fg")}
            />
          ))}
        </div>
      </Sheet>
    </main>
  );
}
