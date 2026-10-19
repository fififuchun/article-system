import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import TailwindRepro from "./TailwindRepro";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TailwindRepro />
  </StrictMode>
);
