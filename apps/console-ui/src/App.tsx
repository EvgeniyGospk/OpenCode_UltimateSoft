import { RouterProvider } from "react-router-dom";
import { appRouter } from "@/routes/app-router";

export function App() {
  return <RouterProvider router={appRouter} />;
}
