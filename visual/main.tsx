import { createIsland } from "@askrjs/askr/boot";
import { VisualCatalog } from "../examples/catalog";
import "../src/styles.css";
import "./visual.css";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Visual lab root is missing.");
createIsland({ root, component: VisualCatalog });
