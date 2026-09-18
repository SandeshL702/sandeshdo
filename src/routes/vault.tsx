import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Eye, EyeOff, Plus } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { HeaderActions } from "@/components/header-actions";
import { Sheet } from "@/components/sheet";
import { Button, Input } from "@/components/ui";
import { useApp } from "@/lib/store";
import { useT } from "@/lib/i18n";
import type { VaultItem, VaultKind } from "@/lib/types";

export const Route = createFileRoute("/vault")({ component: VaultPage });

const KINDS: VaultKind[] = ["password", "pin", "card", "note"];

export function VaultPage() {
  const { t } = useT();
  const items = useApp((s) => s.vault);
  const addVaultItem = useApp((s) => s.addVaultItem);
  const updateVaultItem = useApp((s) => s.updateVaultItem);
  const deleteVaultItem = useApp((s) => s.deleteVaultItem);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<VaultItem | null>(null);
  const [label, setLabel] = useState("");
  const [secret, setSecret] = useState("");
  const [kind, setKind] = useState<VaultKind>("password");
  const [showId, setShowId] = useState<string | null>(null);

  const startNew = () => {
    setEditing(null);
    setLabel("");
    setSecret("");
    setKind("password");
    setOpen(true);
  };

  const startEdit = (item: VaultItem) => {
    setEditing(item);
    setLabel(item.label);
    setSecret(item.secret);
    setKind(item.kind);
    setOpen(true);
  };

  const save = () => {
    if (!label.trim() || !secret.trim()) return;
    if (editing) updateVaultItem(editing.id, { label: label.trim(), secret, kind });
    else addVaultItem({ kind, label: label.trim(), secret });
    setOpen(false);
  };

  return (
    <main className="overflow-x-hidden px-5 pt-5 pb-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <BrandMark compact />
          <h1 className="font-display mt-3 text-title leading-none font-medium tracking-tight">{t("vault.title")}</h1>
          <p className="mt-1.5 text-sm text-muted">{t("vault.secureHint")}</p>
        </div>
        <HeaderActions />
      </div>
      <button
        type="button"
        onClick={startNew}
        className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-semibold text-primary-fg"
      >
        <Plus className="size-4" />
        {t("vault.add")}
      </button>
      <div className="mt-4 space-y-2">
        {items.length === 0 ? (
          <p className="px-1 pt-4 text-sm text-muted">{t("vault.empty")}</p>
        ) : (
          items.map((item) => {
            const shown = showId === item.id;
            return (
              <div key={item.id} className="rounded-[1.35rem] bg-surface px-4 py-4 shadow-[var(--sd-card-shadow)]">
                <div className="flex items-center gap-3">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => startEdit(item)}>
                    <div className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">{item.kind}</div>
                    <div className="mt-0.5 text-sm font-semibold">{item.label}</div>
                    <div className="mt-1 font-mono text-sm tabular-nums">{shown ? item.secret : "••••••••"}</div>
                  </button>
                  <button
                    type="button"
                    aria-label={shown ? t("vault.hide") : t("vault.show")}
                    className="flex size-11 items-center justify-center rounded-2xl text-muted"
                    onClick={() => setShowId(shown ? null : item.id)}
                  >
                    {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? t("vault.title") : t("vault.add")}
        footer={
          <div className="flex gap-2">
            {editing && (
              <Button
                variant="danger"
                className="flex-1"
                onClick={() => {
                  deleteVaultItem(editing.id);
                  setOpen(false);
                }}
              >
                {t("notes.delete")}
              </Button>
            )}
            <Button className="flex-1" onClick={save} disabled={!label.trim() || !secret.trim()}>
              {t("notes.save")}
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={
                kind === k
                  ? "h-10 rounded-full bg-primary px-3 text-xs font-semibold text-primary-fg"
                  : "h-10 rounded-full bg-bg px-3 text-xs font-semibold text-muted shadow-[var(--sd-card-shadow)]"
              }
            >
              {k}
            </button>
          ))}
        </div>
        <Input className="mt-3" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("vault.label")} />
        <Input className="mt-3" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={t("vault.secret")} />
      </Sheet>
    </main>
  );
}
