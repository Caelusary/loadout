import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App.jsx';
// Self-hosted fonts: served from our own origin with the app's CSS, so they arrive together instead of
// trickling in from a third party and reflowing the page once per family. Unicode ranges keep unused
// subsets (like the one holding the peso sign) from downloading until a page needs them.
import '@fontsource/chakra-petch/600.css';
import '@fontsource/chakra-petch/700.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './index.css';
import { AuthProvider } from './providers/AuthProvider.jsx';
import { CartProvider } from './providers/CartProvider.jsx';
import { CompareProvider } from './providers/CompareProvider.jsx';
import { ThemeProvider } from './providers/ThemeProvider.jsx';
import { PerformanceProvider } from './providers/PerformanceProvider.jsx';
import { ToastProvider } from './providers/ToastProvider.jsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Retry network and server errors only; a 4xx answer won't change on retry.
      retry: (count, error) => (error?.status === 0 || error?.status >= 500) && count < 2,
    },
    mutations: { retry: false },
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <PerformanceProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <CartProvider>
              <CompareProvider>
                <App />
              </CompareProvider>
            </CartProvider>
          </ToastProvider>
        </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
      </PerformanceProvider>
    </ThemeProvider>
  </StrictMode>,
);
