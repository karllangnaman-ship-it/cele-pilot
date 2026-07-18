import React, { memo, useMemo } from "react";
import { LatexText } from "@/components/LatexFormula";

const engineeringSymbols = {
  alpha: "\\alpha",
  beta: "\\beta",
  delta: "\\delta",
  epsilon: "\\epsilon",
  mu: "\\mu",
  rho: "\\rho",
  sigma: "\\sigma",
  tau: "\\tau",
  theta: "\\theta",
};

const normalizeMath = (value) =>
  String(value ?? "").replace(/\$\$([\s\S]*?)\$\$|\$([^$]+)\$/g, (match, block, inline) => {
    const expression = (block ?? inline).replace(
      /\b(alpha|beta|delta|epsilon|mu|rho|sigma|tau|theta)\b/g,
      (name) => engineeringSymbols[name],
    );
    return block !== undefined ? `$$${expression}$$` : `$${expression}$`;
  });

class LatexErrorFallback extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error("[Question LaTeX] Rendering failed", error);
  }

  componentDidUpdate(previousProps) {
    if (previousProps.value !== this.props.value && this.state.failed)
      this.setState({ failed: false });
  }

  render() {
    return this.state.failed ? this.props.value : this.props.children;
  }
}

function QuestionLatexRenderer({ value }) {
  const normalizedValue = useMemo(() => normalizeMath(value), [value]);
  return <LatexErrorFallback value={String(value ?? "")}><LatexText value={normalizedValue} /></LatexErrorFallback>;
}

export default memo(QuestionLatexRenderer);
