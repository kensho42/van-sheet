import van from "vanjs-core";

const SVG_NS = "http://www.w3.org/2000/svg";
const { svg, path } = van.tags(SVG_NS);

const createPath = (d: string): SVGPathElement =>
  path({
    d,
    stroke: "#999999",
    "stroke-width": "3",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  }) as SVGPathElement;

export const createDefaultCloseIcon = (): SVGSVGElement =>
  svg(
    {
      width: "12",
      height: "12",
      viewBox: "0 0 12 12",
      fill: "none",
      xmlns: SVG_NS,
      "aria-hidden": "true",
    },
    createPath("M10.4854 1.99998L2.00007 10.4853"),
    createPath("M10.4854 10.4844L2.00007 1.99908"),
  ) as SVGSVGElement;
