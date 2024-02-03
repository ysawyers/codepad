import "./index.css";
import { Enviornment } from "./Enviornment";

// create tree of linkedlist partialHeads for easy grouping! (use cases tho?)
// create type interface for window (contextBridge API)

// when logging document fragment it will see things from future mutations ?????

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

const env = new Enviornment();
