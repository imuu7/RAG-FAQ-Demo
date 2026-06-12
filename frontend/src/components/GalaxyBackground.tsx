/**
 * 銀河背景:固定鋪滿視窗的多層星空,只在深色主題顯示
 * (顯示與否由 index.css 的 [data-theme="dark"] 控制,元件本身不需知道 theme)。
 *
 * 純視覺、無 props、aria-hidden:星雲漸層 + 遠近兩層星點,各自跑輕量 CSS 動畫
 * (呼吸閃爍 + 極慢漂移);減少動態偏好時由全域 prefers-reduced-motion 規則停住。
 */
export default function GalaxyBackground() {
  return (
    <div className="galaxy" aria-hidden="true">
      <div className="galaxy__nebula" />
      <div className="galaxy__stars galaxy__stars--far" />
      <div className="galaxy__stars galaxy__stars--near" />
    </div>
  );
}
