import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { router } from "./routes/router.jsx";
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
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
