import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PlaceholderPanelProps {
  title: string;
  body: string;
  footer?: ReactNode;
}

export function PlaceholderPanel({ title, body, footer }: PlaceholderPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-[var(--color-muted)]">{body}</p>
        {footer ? <div>{footer}</div> : null}
      </CardContent>
    </Card>
  );
}
