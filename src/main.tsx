import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DiveSlate } from "@/components/dive-slate";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DiveSlate />
  </StrictMode>,
);
