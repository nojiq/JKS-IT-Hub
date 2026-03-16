import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { router } from "./routes/router.jsx";
import { ToastProvider } from "./shared/components/Toast/ToastProvider.jsx";
import { ThemeProvider } from "./shared/context/ThemeProvider";
import ConnectionStatus from "./shared/components/ConnectionStatus.jsx";
import { SSEProvider } from "./shared/contexts/SSEContext.jsx";
import "./styles/index.css";

const rootElement = document.getElementById("root");
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false
    }
  }
});

if (rootElement) {
  createRoot(rootElement).render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <SSEProvider>
            <RouterProvider router={router} />
            <ConnectionStatus />
          </SSEProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
