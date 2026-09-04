import type { FlowClass, FlowEdge, FlowNode } from "./layout";

/// Generates a standalone SVG document of the laid-out e-graph, mirroring how the React Flow
/// nodes and edges are styled in `Visualizer.tsx` so that the download looks like what is on screen.

// Padding around the whole graph, in pixels
const padding = 10;
// Matches tailwind `rounded-md`
const cornerRadius = 6;
// Matches tailwind `p-1`
const nodePadding = 4;
// Matches tailwind `text-base`
const labelFontSize = 16;
// Matches the inline font size used for extra class data
const extraFontSize = 6;
// Matches `extra_padding` in layout.ts, the vertical space per extra class item
const extraLineHeight = 8;
// Matches tailwind `font-mono`
const fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

// Tailwind colors used in the visualizer
const indigo600 = "#4f46e5";
const gray300 = "#d1d5db";

function escapeXML(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function round(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/// Text that is clipped to a box, so overly long labels don't spill outside their node like `truncate` does in the DOM
function clippedText(box: { x: number; y: number; width: number; height: number }, text: string): string {
  return `<svg x="${round(box.x)}" y="${round(box.y)}" width="${round(box.width)}" height="${round(box.height)}" overflow="hidden">${text}</svg>`;
}

function renderClass(node: FlowClass): string {
  const { x, y } = node.position;
  const width = node.width!;
  const height = node.height!;
  const stroke = node.data.selected ? indigo600 : "black";
  const strokeWidth = node.selected ? 2 : 1;
  const rect =
    `<rect x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(height)}" rx="${cornerRadius}" ` +
    `fill="${escapeXML(node.data.color || "white")}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-dasharray="1 2"/>`;
  const extraLines = Object.entries(node.data.extra || {})
    .map(([key, value], index) => {
      const lineY = nodePadding + index * extraLineHeight;
      const keySpan = key === "" ? "" : `<tspan font-weight="bold">${escapeXML(key)}</tspan><tspan xml:space="preserve"> </tspan>`;
      return `<text x="${nodePadding}" y="${round(lineY)}" font-size="${extraFontSize}" dominant-baseline="hanging" xml:space="preserve">${keySpan}${escapeXML(value)}</text>`;
    })
    .join("");
  const extra = extraLines ? clippedText({ x, y, width, height }, extraLines) : "";
  return `<g id="${escapeXML(node.id)}">${rect}${extra}</g>`;
}

function renderNode(node: FlowNode, classPositions: Map<string, { x: number; y: number }>): string {
  const parent = classPositions.get(node.parentId!) || { x: 0, y: 0 };
  const x = node.position.x + parent.x;
  const y = node.position.y + parent.y;
  const width = node.width!;
  const height = node.height!;
  const subsumed = node.data.subsumed || false;
  const selected = node.data.selected;
  const stroke = subsumed && selected ? "#e0e7ff" : subsumed ? gray300 : selected ? indigo600 : "black";
  const strokeWidth = node.selected ? 2 : 1;
  const rect =
    `<rect x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(height)}" rx="${cornerRadius}" ` +
    `fill="white" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
  const label =
    `<text x="${round(width / 2)}" y="${round(height / 2)}" font-size="${labelFontSize}" text-anchor="middle" dominant-baseline="central"` +
    `${subsumed ? ` fill="${gray300}"` : ""}>${escapeXML(node.data.label)}</text>`;
  return `<g id="${escapeXML(node.id)}">${rect}${clippedText({ x, y, width, height }, label)}</g>`;
}

function renderEdge(edge: FlowEdge): string {
  const path = edge.data!.points.map(({ x, y }, index) => `${index === 0 ? "M" : "L"} ${round(x)} ${round(y)}`).join(" ");
  return `<path id="${escapeXML(edge.id)}" d="${path}" fill="none" stroke="black" stroke-width="${edge.selected ? 1 : 0.5}" marker-end="url(#arrow)"/>`;
}

export function graphToSVG(nodes: (FlowClass | FlowNode)[], edges: FlowEdge[]): string {
  const classes = nodes.filter((node): node is FlowClass => node.type === "class");
  const eNodes = nodes.filter((node): node is FlowNode => node.type === "node");
  const classPositions = new Map(classes.map((node) => [node.id, node.position]));

  // Compute the bounding box of everything drawn
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of classes) {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + node.width!);
    maxY = Math.max(maxY, node.position.y + node.height!);
  }
  for (const edge of edges) {
    for (const { x, y } of edge.data!.points) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (!isFinite(minX)) {
    minX = minY = maxX = maxY = 0;
  }
  const viewBox = [minX - padding, minY - padding, maxX - minX + 2 * padding, maxY - minY + 2 * padding].map(round);

  // Arrow head marker matching React Flow's `MarkerType.ArrowClosed`
  const defs =
    `<defs><marker id="arrow" viewBox="-10 -10 20 20" markerWidth="12.5" markerHeight="12.5" markerUnits="strokeWidth" orient="auto-start-reverse" refX="0" refY="0">` +
    `<polyline points="-5,-4 0,0 -5,4 -5,-4" fill="black" stroke="black" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</marker></defs>`;

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.join(" ")}" width="${viewBox[2]}" height="${viewBox[3]}" font-family='${fontFamily}'>\n` +
    `${defs}\n` +
    `<g id="edges">${edges.map(renderEdge).join("\n")}</g>\n` +
    `<g id="classes">${classes.map(renderClass).join("\n")}</g>\n` +
    `<g id="nodes">${eNodes.map((node) => renderNode(node, classPositions)).join("\n")}</g>\n` +
    `</svg>\n`
  );
}

/// Trigger a browser download of the given SVG text
export function downloadSVG(svg: string, filename: string) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser a moment to start the download before revoking
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
