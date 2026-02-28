import * as React from "react";
import { cn } from "@/lib/cn";
import { FORM_CONTROL_BASE } from "@/components/ui/form-styles";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(`${FORM_CONTROL_BASE} py-2 font-mono`, className)}
    {...props}
  />
));

Textarea.displayName = "Textarea";

export { Textarea };
