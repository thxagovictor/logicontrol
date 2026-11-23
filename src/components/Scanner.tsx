import { useEffect } from "react";

export default function Scanner({ onRead, onClose }: { onRead: (c: string) => void; onClose: () => void }) {
  useEffect(() => {
    let s: any; let done = false;
    import("html5-qrcode").then(({ Html5Qrcode }) => {
      s = new Html5Qrcode("leitor");
      s.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (t: string) => {
        if (done) return; done = true; onRead(t); s.stop().catch(() => {}); onClose();
      }, () => {}).catch(() => { alert("Não foi possível abrir a câmera. Verifique a permissão."); onClose(); });
    });
    return () => { if (s?.isScanning) s.stop().catch(() => {}); };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-foreground/90 p-4">
      <div id="leitor" className="w-full max-w-sm overflow-hidden rounded-2xl bg-background" />
      <button className="rounded-xl bg-background px-6 py-2.5 text-sm font-semibold" onClick={onClose}>Cancelar</button>
    </div>
  );
}
