import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/context/AuthContext';
import { TenantProvider } from '@/context/TenantContext';
import { ThemeProviderWrapper } from '@/components/ThemeProviderWrapper';

const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: 'NCRelay',
  description: 'Securely relay notifications to your favorite platforms.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <AuthProvider>
          <TenantProvider>
            <ThemeProviderWrapper>
              {children}
              <Toaster />
            </ThemeProviderWrapper>
          </TenantProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
