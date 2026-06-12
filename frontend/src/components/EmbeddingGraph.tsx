import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import type { GraphResponse } from "../api";
import type { Theme } from "./ThemeToggle";

interface EmbeddingGraphProps {
  data: GraphResponse;
  theme: Theme;
}

/**
 * Embedding 星圖:query 釘死中心,全語料段落依「與 query 的餘弦相似度」放射。
 * 命中段落(top-k)用朱砂粗邊 + 流動粒子 + 光暈點亮,其餘為暗淡星點。
 *
 * 關鍵:bge-m3 的距離常擠在窄區間(如 0.57~0.70),所以用 min-max 正規化把
 * 這批距離拉開到 [rMin, rMax],放射的親疏層次才明顯。
 */
export default function EmbeddingGraph({ data, theme }: EmbeddingGraphProps) {
  const fgRef = useRef<any>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const HEIGHT = 520;

  // 量測容器寬(react-force-graph 需要明確 width/height)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 這批距離的 min/max,用來把半徑正規化拉開層次
  const { dmin, dmax } = useMemo(() => {
    const ds = data.nodes.map((n) => n.distance);
    return { dmin: Math.min(...ds), dmax: Math.max(...ds) };
  }, [data]);

  // cos 距離 → 邊長(px):正規化到 70(最相似,靠中心)~380(最不相似,外圈)
  const linkLen = (d: number) => {
    const t = dmax > dmin ? (d - dmin) / (dmax - dmin) : 0;
    return 70 + t * 310;
  };

  // 組 graphData:中心 query 節點(fx/fy 釘死 0,0) + 全 docs;每個 doc 連一條邊
  const graphData = useMemo(
    () => ({
      nodes: [
        {
          id: "__q__",
          kind: "query",
          label: data.question,
          fx: 0,
          fy: 0,
        },
        ...data.nodes.map((n) => ({
          id: n.id,
          kind: n.hit ? "hit" : "doc",
          source: n.source,
          content: n.content,
          distance: n.distance,
          sim: Math.max(0, 1 - n.distance),
        })),
      ],
      links: data.nodes.map((n) => ({
        source: "__q__",
        target: n.id,
        distance: n.distance,
        hit: n.hit,
      })),
    }),
    [data]
  );

  // 設定力:link 距離依相似度、charge 斥力散開
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.d3Force("link")?.distance((l: any) => linkLen(l.distance));
    fg.d3Force("charge")?.strength(-150);
    fg.d3ReheatSimulation();
    // dmin/dmax 變動時(換問題)重設力
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData]);

  const C =
    theme === "dark"
      ? {
          query: "#8b9cff",
          hit: "#e879f9",
          doc: "#5a6088",
          line: "rgba(174,184,232,0.20)",
          text: "#ecedfb",
        }
      : {
          query: "#4f5bd5",
          hit: "#4f8ad5",
          doc: "#a8c0d8",
          line: "rgba(70,130,190,0.30)",
          text: "#16314a",
        };

  return (
    <div ref={wrapRef} className="graph-wrap">
      <span className="graph-hint">滾輪縮放 · 拖曳平移 · hover 看相似度</span>

      <ForceGraph2D
        ref={fgRef}
        width={width}
        height={HEIGHT}
        graphData={graphData as any}
        backgroundColor="rgba(0,0,0,0)"
        cooldownTicks={140}
        onEngineStop={() => fgRef.current?.zoomToFit(500, 50)}
        linkColor={(l: any) => (l.hit ? C.hit : C.line)}
        linkWidth={(l: any) => (l.hit ? 2 : 0.5)}
        linkDirectionalParticles={(l: any) => (l.hit ? 4 : 0)}
        linkDirectionalParticleWidth={2.4}
        linkDirectionalParticleSpeed={0.006}
        linkDirectionalParticleColor={() => C.hit}
        nodeLabel={(n: any) =>
          n.kind === "query"
            ? `<b>問題</b><br/>${n.label}`
            : `<b>${n.source ?? "未標註來源"}</b><br/>相似度 ${Math.round(
                n.sim * 100
              )}% · cos ${n.distance.toFixed(3)}${n.hit ? " · 命中" : ""}`
        }
        nodeCanvasObject={(node: any, ctx, scale) => {
          // 力學模擬初期 node.x/y 可能還是 NaN,先擋掉避免 canvas API 拋錯
          if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
          const r =
            node.kind === "query"
              ? 10
              : node.kind === "hit"
              ? 5 + node.sim * 5
              : 3;
          const color = C[node.kind as "query" | "hit" | "doc"];

          // 光暈(query / 命中才畫)
          if (node.kind !== "doc") {
            const g = ctx.createRadialGradient(
              node.x,
              node.y,
              0,
              node.x,
              node.y,
              r * 3.2
            );
            g.addColorStop(0, color + "66");
            g.addColorStop(1, color + "00");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(node.x, node.y, r * 3.2, 0, 2 * Math.PI);
            ctx.fill();
          }

          // 節點圓
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
          ctx.fill();

          // 標籤(query 與命中節點才標,避免 17 個全標太亂)
          if (node.kind !== "doc") {
            const label =
              node.kind === "query" ? "問題" : node.source ?? "";
            ctx.font = `${12 / scale}px "Noto Sans TC", sans-serif`;
            ctx.fillStyle = C.text;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillText(label, node.x, node.y + r + 4 / scale);
          }
        }}
      />

      <div className="graph-legend">
        <span className="graph-legend__item">
          <span className="graph-legend__dot graph-legend__dot--q" />問題
        </span>
        <span className="graph-legend__item">
          <span className="graph-legend__dot graph-legend__dot--hit" />命中段落
        </span>
        <span className="graph-legend__item">
          <span className="graph-legend__dot graph-legend__dot--doc" />其他語料
        </span>
      </div>
    </div>
  );
}
