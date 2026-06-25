import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Sparkles, Send, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

const SUGGESTIONS = [
  "Who are my highest flight risk performers?",
  "Which team requires immediate HRBP intervention?",
  "Show succession risks.",
  "Which employees deserve recognition this cycle?",
  "Who should be promoted in the next cycle?",
  "Show critical talent with low engagement.",
];

export function AiCopilot({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [input, setInput] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
  }, []);

  const transport = useRef<DefaultChatTransport<never> | null>(null);
  if (token && !transport.current) {
    transport.current = new DefaultChatTransport({
      api: "/api/chat",
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  const { messages, sendMessage, status, error } = useChat({
    id: "hrbp-copilot",
    transport: transport.current ?? new DefaultChatTransport({ api: "/api/chat" }),
  });

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open, messages.length]);

  const send = async (text: string) => {
    if (!text.trim() || !token) return;
    setInput("");
    await sendMessage({ text: text.trim() });
  };

  const isLoading = status === "submitted" || status === "streaming";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-3 border-b">
          <SheetTitle className="font-display flex items-center gap-2">
            <span className="size-7 rounded-md bg-accent text-accent-foreground grid place-items-center">
              <Sparkles className="size-4" />
            </span>
            HRBP Copilot
          </SheetTitle>
          <SheetDescription>Ask anything about your visible team. Answers are scoped to your access.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Try one of these:</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((q) => (
                  <button key={q} onClick={() => send(q)}
                    className="text-xs px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/70 text-secondary-foreground transition">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => {
            const text = m.parts.map((p) => p.type === "text" ? p.text : "").join("");
            return (
              <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
                <div className={m.role === "user"
                  ? "max-w-[85%] bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2.5 text-sm"
                  : "max-w-full prose prose-sm prose-slate dark:prose-invert prose-headings:font-display prose-p:my-2 prose-ul:my-2 prose-table:text-xs"}>
                  {m.role === "user" ? text : <ReactMarkdown>{text}</ReactMarkdown>}
                </div>
              </div>
            );
          })}
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Thinking…
            </div>
          )}
          {error && (
            <div className="text-sm text-rag-red bg-rag-red/10 border border-rag-red/20 rounded-md p-3">
              {error.message || "Something went wrong"}
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="border-t p-4 flex gap-2 items-end"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder={token ? "Ask the Copilot…" : "Loading session…"}
            disabled={!token || isLoading}
            rows={1}
            className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring max-h-32"
          />
          <Button type="submit" size="sm" disabled={!token || isLoading || !input.trim()} className="gap-1.5">
            <Send className="size-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function AiCopilotLauncher() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 group flex items-center gap-2 pl-3 pr-4 py-3 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition"
        aria-label="Open HRBP Copilot"
      >
        <span className="size-6 rounded-full bg-primary-foreground/15 grid place-items-center">
          <Sparkles className="size-3.5" />
        </span>
        <span className="text-sm font-medium">Ask Copilot</span>
      </button>
      <AiCopilot open={open} onOpenChange={setOpen} />
    </>
  );
}

// suppress unused
void X;
