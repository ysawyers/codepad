import "./index.css";
import { Enviornment } from "./Enviornment";

// prevents default behavior of keys
window.addEventListener(
  "keydown",
  function (e) {
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(e.code) > -1) {
      e.preventDefault();
    }
  },
  false
);

// prevent default text highlighting
window.addEventListener("mousemove", (e) => {
  e.preventDefault();
});

// prevent double click text highlighting (NOTE: MAY BREAK SOME THINGS SO REMEMBER THIS!)
window.addEventListener("mousedown", (e) => {
  if (e.detail >= 2) e.preventDefault();
});

const env = new Enviornment();
