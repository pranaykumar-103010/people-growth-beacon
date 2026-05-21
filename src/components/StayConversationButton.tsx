import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Sparkles, Loader2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { suggestStayQuestions } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { RagBadge } from "@/components/Rag";
import type { Employee } from "@/lib/types";

export function StayConversationButton({ employee }: { employee: Employee }) {
  const suggest = useServerFn(suggestStayQuestions);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<string>("");

  const run = async () => {
    setOpen(true);
    setLoading(true);
    setContent("");
    try {
      const { content } = await suggest({ data: { employeeId: employee.id } });
      setContent(content);
    } catch (e) {
      toast.error((e as Error).message);
      setOpen(false);
    } finally { setLoading(false); }
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={run} className="gap-1.5">
        <Sparkles className="size-3.5" /> Suggest Stay Conversation
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-6">
          <SheetHeader className="space-y-1.5 mb-4">
            <SheetTitle className="flex items-center gap-2 font-display">
              <Sparkles className="size-4 text-accent" />
              Stay Conversation Guide
            </SheetTitle>
            <SheetDescription>
              For <span className="font-medium text-foreground">{employee.name}</span> · <RagBadge score={employee.risk_score} />
            </SheetDescription>
          </SheetHeader>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" /> Drafting personalized questions…
            </div>
          ) : (
            <article className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed">{content}</article>
          )}
          <div className="mt-6 pt-4 border-t">
            <Link to="/attrition" hash={employee.id} className="text-sm text-accent hover:underline inline-flex items-center gap-1">
              Open full profile <ChevronRight className="size-3.5" />
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
