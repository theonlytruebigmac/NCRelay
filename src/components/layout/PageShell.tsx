
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageShellProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function PageShell({
  title,
  description,
  actions,
  children,
  className,
  ...props
}: PageShellProps) {
  return (
    <div className={cn("space-y-6", className)} {...props}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}
