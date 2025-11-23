"use client";

import { useEffect, useState } from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { PageShell } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { Loader2, FileJson, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ApiDocsPage() {
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Swagger UI loads asynchronously
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleCopySpec = async () => {
    try {
      const response = await fetch('/api/docs/openapi.json');
      const spec = await response.json();
      await navigator.clipboard.writeText(JSON.stringify(spec, null, 2));
      setCopied(true);
      toast({
        title: 'Copied!',
        description: 'OpenAPI specification copied to clipboard',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to copy specification',
      });
    }
  };

  return (
    <PageShell
      title="API Documentation"
      description="Interactive API documentation powered by Swagger UI"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopySpec}>
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Copied
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copy Spec
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="/api/docs/openapi.json" target="_blank" rel="noopener noreferrer">
              <FileJson className="mr-2 h-4 w-4" />
              View JSON
            </a>
          </Button>
        </div>
      }
    >
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
      
      <div
        className={loading ? 'hidden' : 'swagger-container'}
        style={{
          '--swagger-ui-background': 'transparent',
        } as React.CSSProperties}
      >
        <SwaggerUI
          url="/api/docs/openapi.json"
          docExpansion="list"
          defaultModelsExpandDepth={1}
          defaultModelExpandDepth={1}
          displayRequestDuration={true}
          filter={true}
          showExtensions={true}
          showCommonExtensions={true}
          tryItOutEnabled={true}
        />
      </div>

      <style jsx global>{`
        .swagger-container .swagger-ui {
          font-family: inherit;
        }
        .swagger-ui .topbar {
          display: none;
        }
        .swagger-ui .info {
          margin: 0 0 30px 0;
        }
        .swagger-ui .scheme-container {
          background: transparent;
          box-shadow: none;
          padding: 0;
          margin: 20px 0;
        }
        .swagger-ui .opblock-tag {
          border-bottom: 1px solid hsl(var(--border));
          margin-bottom: 10px;
        }
        .swagger-ui .opblock {
          border: 1px solid hsl(var(--border));
          border-radius: 8px;
          margin-bottom: 15px;
          background: hsl(var(--card));
        }
        .swagger-ui .opblock .opblock-summary {
          border-bottom: 1px solid hsl(var(--border));
        }
        .swagger-ui .opblock-description-wrapper,
        .swagger-ui .opblock-external-docs-wrapper,
        .swagger-ui .opblock-title_normal {
          padding: 15px;
          background: hsl(var(--card));
        }
        .swagger-ui .btn {
          border-radius: 6px;
        }
        .swagger-ui .response-col_status {
          font-size: 14px;
        }
        .swagger-ui table thead tr th,
        .swagger-ui table thead tr td {
          color: hsl(var(--foreground));
          border-bottom: 1px solid hsl(var(--border));
        }
        .swagger-ui .parameter__name,
        .swagger-ui .parameter__type {
          color: hsl(var(--foreground));
        }
        .swagger-ui .model-title {
          color: hsl(var(--foreground));
        }
        .swagger-ui section.models {
          border: 1px solid hsl(var(--border));
          border-radius: 8px;
          background: hsl(var(--card));
        }
        .swagger-ui section.models h4 {
          margin: 0;
          padding: 15px;
          border-bottom: 1px solid hsl(var(--border));
        }
      `}</style>
    </PageShell>
  );
}
