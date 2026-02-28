import * as React from "react";
import { cn } from "@/lib/cn";
import { FORM_CONTROL_CLASS } from "@/components/ui/form-styles";

const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(FORM_CONTROL_CLASS, className)}
    {...props}
  />
));

Select.displayName = "Select";

export { Select };
