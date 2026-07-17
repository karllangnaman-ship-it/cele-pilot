const GREEK = {
  alpha: "\\alpha", beta: "\\beta", gamma: "\\gamma", delta: "\\delta", Delta: "\\Delta",
  epsilon: "\\epsilon", varepsilon: "\\varepsilon", zeta: "\\zeta", eta: "\\eta", theta: "\\theta", Theta: "\\Theta",
  iota: "\\iota", kappa: "\\kappa", lambda: "\\lambda", Lambda: "\\Lambda", mu: "\\mu", nu: "\\nu", xi: "\\xi",
  pi: "\\pi", Pi: "\\Pi", rho: "\\rho", sigma: "\\sigma", Sigma: "\\Sigma", tau: "\\tau", phi: "\\phi", Phi: "\\Phi",
  chi: "\\chi", psi: "\\psi", Psi: "\\Psi", omega: "\\omega", Omega: "\\Omega",
};

const UNICODE_GREEK = { "α": "\\alpha", "β": "\\beta", "γ": "\\gamma", "δ": "\\delta", "Δ": "\\Delta", "ε": "\\epsilon", "θ": "\\theta", "Θ": "\\Theta", "λ": "\\lambda", "Λ": "\\Lambda", "μ": "\\mu", "ν": "\\nu", "ξ": "\\xi", "π": "\\pi", "Π": "\\Pi", "ρ": "\\rho", "σ": "\\sigma", "Σ": "\\Sigma", "τ": "\\tau", "φ": "\\phi", "Φ": "\\Phi", "χ": "\\chi", "ψ": "\\psi", "Ψ": "\\Psi", "ω": "\\omega", "Ω": "\\Omega" };
const OPERATORS = { "×": "\\times", "÷": "\\div", "≠": "\\ne", "≈": "\\approx", "≤": "\\le", "≥": "\\ge", "±": "\\pm", "∓": "\\mp", "∞": "\\infty", "∝": "\\propto", "∂": "\\partial", "∇": "\\nabla", "∫": "\\int", "∬": "\\iint", "∭": "\\iiint", "∮": "\\oint", "∑": "\\sum", "∏": "\\prod", "√": "\\sqrt{}", "∛": "\\sqrt[3]{}", "∜": "\\sqrt[4]{}", "°": "^\\circ", "∠": "\\angle", "⊥": "\\perp", "∥": "\\parallel", "⇒": "\\Rightarrow", "⇔": "\\Leftrightarrow", "→": "\\to", "←": "\\leftarrow", "↔": "\\leftrightarrow" };
const SUPERSCRIPTS = { "²": "^{2}", "³": "^{3}", "⁴": "^{4}", "¹": "^{1}", "⁰": "^{0}" };

/** Converts familiar CELE engineering shorthand into KaTeX-compatible LaTeX. */
export function normalizeEngineeringNotation(value) {
  let text = String(value ?? "");
  if (!text) return text;
  Object.entries(SUPERSCRIPTS).forEach(([symbol, latex]) => { text = text.split(symbol).join(latex); });
  text = text.replace(/\b(sigma|tau)(xy|xz|yz|x|y|z)\b/g, (_, symbol, subscript) => `${GREEK[symbol]}_{${subscript}}`);
  text = text.replace(/\b([FMVP])([xyz]|[12])\b/g, "$1_{$2}");
  text = text.replace(/([στ])([xyz]{1,2})/g, (_, symbol, subscript) => `${UNICODE_GREEK[symbol]}_{${subscript}}`);
  text = text.replace(/\b([A-Za-z]{1,5})\/([A-Za-z]{1,5})\b/g, "\\frac{$1}{$2}");
  text = text.replace(/\bsqrt\(([^()]+)\)/g, "\\sqrt{$1}");
  text = text.replace(/\bvec\(([^()]+)\)/g, "\\vec{$1}");
  Object.entries(UNICODE_GREEK).forEach(([symbol, latex]) => { text = text.split(symbol).join(latex); });
  Object.entries(GREEK).forEach(([word, latex]) => { text = text.replace(new RegExp(`(^|[^\\\\A-Za-z])(${word})(?=$|[^A-Za-z])`, "g"), `$1${latex}`); });
  Object.entries(OPERATORS).forEach(([symbol, latex]) => { text = text.split(symbol).join(latex); });
  return text;
}
