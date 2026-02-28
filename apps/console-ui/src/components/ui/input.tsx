import * as React from "react";
import { cn } from "@/lib/cn";
import { FORM_CONTROL_CLASS } from "@/components/ui/form-styles";

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(FORM_CONTROL_CLASS, className)}
    {...props}
  />
));

Input.displayName = "Input";

export { Input };
