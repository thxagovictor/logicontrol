import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
const Scanner = lazy(() => import("@/components/Scanner"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LogiControl — Gestão inteligente de mercadorias" },
      { name: "description", content: "Controle de estoque, validade, conferência de pedidos e entregas em um só app." },
      { property: "og:title", content: "LogiControl — Gestão inteligente de mercadorias" },
      { property: "og:description", content: "Estoque, validade, conferência e entregas em um só app." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: App,
});

type Produto = { codigo: string; nome: string; categoria: string; local: string; lote: string; qtd: number; min: number; preco: number; validade: string };
type Status = "Separando" | "Conferido" | "Em rota" | "Entregue" | "Atrasada";
type Pedido = { id: string; cliente: string; endereco: string; prazo: string; status: Status; itens: { codigo: string; qtd: number }[]; check: boolean[]; motorista: string; recebedor: string; ocorrencias: string[] };
type Mov = { data: string; tipo: string; texto: string };
type Dados = { produtos: Produto[]; pedidos: Pedido[]; hist: Mov[] };

const CHECK = ["Códigos dos produtos conferidos", "Quantidades conferidas", "Embalagens sem avaria", "Nota fiscal anexada", "Endereço do cliente confirmado"];
const KEY = "logicontrol-v2";
const add = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const dias = (d: string) => Math.ceil((new Date(d + "T23:59").getTime() - Date.now()) / 864e5);
const br = (d: string) => new Date(d + "T12:00").toLocaleDateString("pt-BR");
const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ped = (id: string, cliente: string, endereco: string, prazo: string, status: Status, itens: Pedido["itens"], motorista = ""): Pedido => ({ id, cliente, endereco, prazo, status, itens, check: CHECK.map(() => status !== "Separando"), motorista, recebedor: status === "Entregue" ? "Recebido no balcão" : "", ocorrencias: [] });

function exemplo(): Dados {
  return {
    produtos: [
      { codigo: "7891000100103", nome: "Leite integral 1L", categoria: "Alimentos", local: "A-01-02", lote: "L2311", qtd: 48, min: 20, preco: 5.49, validade: add(5) },
      { codigo: "7896004000015", nome: "Arroz 5kg", categoria: "Alimentos", local: "B-03-01", lote: "L0987", qtd: 8, min: 15, preco: 27.9, validade: add(180) },
      { codigo: "7891910000197", nome: "Dipirona 500mg", categoria: "Farmácia", local: "F-02-04", lote: "D5521", qtd: 120, min: 30, preco: 8.5, validade: add(25) },
      { codigo: "7898357410015", nome: "Tênis corrida 40", categoria: "Calçados", local: "C-05-03", lote: "-", qtd: 6, min: 4, preco: 249.9, validade: "" },
    ],
    pedidos: [
      ped("PED-1043", "Farmácia Vida", "Rua das Flores, 120", add(1), "Separando", [{ codigo: "7891910000197", qtd: 20 }]),
      ped("PED-1044", "Mercado Bom Preço", "Av. Brasil, 900", add(2), "Separando", [{ codigo: "7891000100103", qtd: 12 }, { codigo: "7896004000015", qtd: 2 }]),
      ped("PED-1042", "Mercado Central", "Rua 7, 45", add(0), "Em rota", [{ codigo: "7891000100103", qtd: 10 }], "Carlos"),
      ped("PED-1039", "Loja Passo Certo", "Av. Norte, 300", add(-1), "Em rota", [{ codigo: "7898357410015", qtd: 2 }], "Ana"),
      ped("PED-1031", "Distribuidora Sul", "Rod. BR-101, km 4", add(-2), "Entregue", [{ codigo: "7896004000015", qtd: 5 }], "Carlos"),
    ],
    hist: [{ data: new Date().toLocaleString("pt-BR"), tipo: "Sistema", texto: "Dados de exemplo carregados" }],
  };
}

const card = "rounded-2xl border bg-card p-4 shadow-sm";
const input = "w-full min-w-0 rounded-xl border bg-background px-3 py-2.5 text-sm";
const btn = "rounded-xl px-4 py-2.5 text-sm font-semibold active:scale-95 transition disabled:opacity-40";
const chip = "rounded-full px-3 py-1 text-xs font-semibold";
const cores: Record<Status, string> = { Separando: "bg-accent text-accent-foreground", Conferido: "bg-secondary text-secondary-foreground", "Em rota": "bg-primary text-primary-foreground", Entregue: "bg-success text-primary-foreground", Atrasada: "bg-destructive text-destructive-foreground" };

function Sheet({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/50 sm:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-3xl bg-background p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h2 className="text-lg font-bold">{titulo}</h2><button aria-label="Fechar" className="text-2xl leading-none" onClick={onClose}>×</button></div>
        {children}
      </div>
    </div>
  );
}
const Campo = ({ r, children }: { r: string; children: ReactNode }) => <label className="block text-xs font-medium text-muted-foreground">{r}<div className="mt-1">{children}</div></label>;

type Aba = "inicio" | "estoque" | "pedidos" | "entregas" | "historico";
const vazio = (): Produto => ({ codigo: "", nome: "", categoria: "", local: "", lote: "", qtd: 0, min: 5, preco: 0, validade: add(90) });

function Login({ onOk }: { onOk: () => void }) {
  const [u, setU] = useState(""); const [s, setS] = useState(""); const [erro, setErro] = useState("");
  return (
    <div className="flex min-h-screen items-center justify-center bg-primary p-4 font-sans">
      <form className="w-full max-w-sm space-y-4 rounded-3xl bg-card p-8 shadow-xl" onSubmit={(e) => { e.preventDefault(); if (u.trim() === "admin" && s === "admin") onOk(); else setErro("Usuário ou senha incorretos"); }}>
        <div className="flex flex-col items-center gap-2"><img src="/icon-192.png" alt="" className="h-16 w-16 rounded-2xl" /><h1 className="text-2xl font-bold">Logi<span className="text-secondary">Control</span></h1><p className="text-sm text-muted-foreground">Entre para continuar</p></div>
        <label className="block text-sm">Usuário<input className={input + " mt-1"} value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" /></label>
        <label className="block text-sm">Senha<input type="password" className={input + " mt-1"} value={s} onChange={(e) => setS(e.target.value)} autoComplete="current-password" /></label>
        {erro && <p className="text-sm text-destructive">{erro}</p>}
        <button type="submit" className={btn + " w-full bg-primary text-primary-foreground"}>Entrar</button>
      </form>
    </div>
  );
}

function App() {
  const [logado, setLogado] = useState<boolean | null>(null);
  const [desk, setDesk] = useState(false);
  useEffect(() => {
    setLogado(localStorage.getItem("logicontrol-auth") === "admin");
    const f = () => setDesk(window.innerWidth >= 1024 && !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent));
    f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f);
  }, []);
  const [aba, setAba] = useState<Aba>("inicio");
  const [d, setD] = useState<Dados>(exemplo);
  useEffect(() => { const s = localStorage.getItem(KEY); if (s) try { setD(JSON.parse(s)); } catch {} }, []);
  const salvar = (n: Dados, tipo?: string, texto?: string) => {
    const f = texto ? { ...n, hist: [{ data: new Date().toLocaleString("pt-BR"), tipo: tipo!, texto }, ...n.hist].slice(0, 500) } : n;
    setD(f); localStorage.setItem(KEY, JSON.stringify(f));
  };
  const [aviso, setAviso] = useState("");
  const avisar = (t: string) => { setAviso(t); setTimeout(() => setAviso(""), 2500); };

  const [cam, setCam] = useState<null | ((c: string) => void)>(null);
  const [movP, setMovP] = useState<Produto | null>(null);
  const [movQ, setMovQ] = useState(1);
  const [movObs, setMovObs] = useState("");
  const [form, setForm] = useState<{ p: Produto; orig?: string } | null>(null);
  const [pedSel, setPedSel] = useState<string | null>(null);
  const [novoPed, setNovoPed] = useState<Pedido | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "baixo" | "vencendo">("todos");
  const [histF, setHistF] = useState("Todos");

  const prod = (c: string) => d.produtos.find((p) => p.codigo === c);
  const vencendo = d.produtos.filter((p) => p.validade && dias(p.validade) <= 30);
  const baixos = d.produtos.filter((p) => p.qtd < p.min);
  const atrasado = (p: Pedido) => p.status === "Atrasada" || (p.status !== "Entregue" && dias(p.prazo) < 0);
  const atrasadas = d.pedidos.filter(atrasado);
  const valor = d.produtos.reduce((s, p) => s + p.qtd * p.preco, 0);

  const abrirCodigo = (c: string) => {
    const p = prod(c.trim());
    if (p) { setMovP(p); setMovQ(1); setMovObs(""); }
    else { setForm({ p: { ...vazio(), codigo: c.trim() } }); avisar("Código novo: cadastre o produto"); }
  };
  const mover = (tipo: "Entrada" | "Saída" | "Avaria" | "Ajuste") => {
    if (!movP) return;
    if (tipo !== "Entrada" && tipo !== "Ajuste" && movQ > movP.qtd) return avisar("Quantidade maior que o estoque");
    const q = tipo === "Entrada" ? movP.qtd + movQ : tipo === "Ajuste" ? movQ : movP.qtd - movQ;
    salvar({ ...d, produtos: d.produtos.map((x) => (x.codigo === movP.codigo ? { ...x, qtd: q } : x)) }, tipo,
      `${tipo === "Ajuste" ? `Inventário: ${movP.nome} ajustado para ${q}` : `${tipo} de ${movQ} × ${movP.nome} (${movP.local})`}${movObs ? ` — ${movObs}` : ""}`);
    avisar(`${tipo} registrada`); setMovP(null);
  };
  const salvarProd = () => {
    if (!form) return; const { p, orig } = form;
    if (!p.codigo || !p.nome) return avisar("Preencha código e nome");
    if (p.codigo !== orig && prod(p.codigo)) return avisar("Já existe produto com esse código");
    const produtos = orig ? d.produtos.map((x) => (x.codigo === orig ? p : x)) : [...d.produtos, p];
    salvar({ ...d, produtos }, "Cadastro", orig ? `Produto editado: ${p.nome}` : `Cadastro: ${p.nome} em ${p.local || "sem local"}`);
    setForm(null); avisar("Produto salvo");
  };
  const setPed = (id: string, f: (p: Pedido) => Pedido, tipo: string, texto: string) => salvar({ ...d, pedidos: d.pedidos.map((p) => (p.id === id ? f(p) : p)) }, tipo, texto);
  const liberar = (p: Pedido) => {
    const falta = p.itens.find((i) => (prod(i.codigo)?.qtd ?? 0) < i.qtd);
    if (falta) return avisar(`Estoque insuficiente: ${prod(falta.codigo)?.nome ?? falta.codigo}`);
    const produtos = d.produtos.map((x) => { const i = p.itens.find((i) => i.codigo === x.codigo); return i ? { ...x, qtd: x.qtd - i.qtd } : x; });
    salvar({ ...d, produtos, pedidos: d.pedidos.map((x) => (x.id === p.id ? { ...x, status: "Em rota" } : x)) }, "Pedido", `${p.id} conferido, baixado do estoque e enviado${p.motorista ? ` com ${p.motorista}` : ""}`);
    setPedSel(null); setAba("entregas"); avisar("Pedido liberado para entrega");
  };
  const baixar = (nome: string, conteudo: string, tipo: string) => {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([conteudo], { type: tipo })); a.download = nome; a.click();
  };
  const csv = (linhas: (string | number)[][]) => "\ufeff" + linhas.map((l) => l.join(";")).join("\n");

  const lista = d.produtos
    .filter((p) => (p.nome + p.codigo + p.local + p.categoria).toLowerCase().includes(busca.toLowerCase()))
    .filter((p) => filtro === "todos" || (filtro === "baixo" ? p.qtd < p.min : p.validade && dias(p.validade) <= 30));
  const sel = d.pedidos.find((p) => p.id === pedSel);
  const tipos = ["Todos", ...new Set(d.hist.map((h) => h.tipo))];

  if (logado === null) return null;
  if (!logado) return <Login onOk={() => { localStorage.setItem("logicontrol-auth", "admin"); setLogado(true); }} />;
  const sair = () => { localStorage.removeItem("logicontrol-auth"); setLogado(false); };

  return (
    <div className={desk ? "min-h-screen bg-background pl-64 font-sans" : "mx-auto min-h-screen max-w-md bg-background pb-24 font-sans"}>
      <header className="flex items-center gap-3 bg-primary px-5 pb-5 pt-7 text-primary-foreground">
        <img src="/icon-192.png" alt="" className="h-10 w-10 rounded-xl" />
        <h1 className="flex-1 text-xl font-bold">Logi<span className="text-secondary">Control</span></h1>
        <button aria-label="Ler código com a câmera" className="rounded-xl bg-primary-foreground/15 px-3 py-2 text-lg" onClick={() => setCam(() => abrirCodigo)}>📷</button>
        <button aria-label="Sair" className="rounded-xl bg-primary-foreground/15 px-3 py-2 text-sm" onClick={sair}>Sair</button>
      </header>

      <main className={desk ? "mx-auto max-w-6xl space-y-6 p-8" : "space-y-4 p-4"}>
        {aba === "inicio" && (<>
          <div className={desk ? "grid grid-cols-4 gap-4" : "grid grid-cols-2 gap-3"}>
            {([["Produtos", d.produtos.length, "estoque"], ["A separar", d.pedidos.filter((p) => p.status === "Separando" || p.status === "Conferido").length, "pedidos"], ["Em rota", d.pedidos.filter((p) => p.status === "Em rota").length, "entregas"], ["Alertas", vencendo.length + baixos.length + atrasadas.length, "inicio"]] as const).map(([t, v, a]) => (
              <button key={t} onClick={() => setAba(a)} className={card + " text-left"}><div className="text-3xl font-bold">{v}</div><div className="text-xs text-muted-foreground">{t}</div></button>
            ))}
          </div>
          <div className={card}><div className="text-xs text-muted-foreground">Valor total em estoque</div><div className="text-2xl font-bold">{moeda(valor)}</div></div>
          <div className="grid grid-cols-3 gap-2">
            <button className={btn + " bg-primary text-primary-foreground"} onClick={() => setCam(() => abrirCodigo)}>📷 Ler código</button>
            <button className={btn + " bg-secondary text-secondary-foreground"} onClick={() => setForm({ p: vazio() })}>＋ Produto</button>
            <button className={btn + " bg-accent text-accent-foreground"} onClick={() => setNovoPed(ped("", "", "", add(1), "Separando", []))}>＋ Pedido</button>
          </div>
          <div className={card + " space-y-2"}>
            <h2 className="font-bold">Alertas</h2>
            {vencendo.map((p) => <button key={"v" + p.codigo} onClick={() => abrirCodigo(p.codigo)} className="block w-full text-left text-sm">⏳ {p.nome} {dias(p.validade) < 0 ? <b className="text-destructive">VENCIDO</b> : `vence em ${dias(p.validade)} dias`} · {p.local}</button>)}
            {baixos.map((p) => <button key={"b" + p.codigo} onClick={() => abrirCodigo(p.codigo)} className="block w-full text-left text-sm">📉 Repor: {p.nome} ({p.qtd}/{p.min}) — sugerido {p.min * 2 - p.qtd} un</button>)}
            {atrasadas.map((p) => <button key={"a" + p.id} onClick={() => setPedSel(p.id)} className="block w-full text-left text-sm text-destructive">🚚 Atraso: {p.id} — {p.cliente}</button>)}
            {!vencendo.length && !baixos.length && !atrasadas.length && <p className="text-sm text-muted-foreground">Tudo em ordem.</p>}
          </div>
        </>)}

        {aba === "estoque" && (<>
          <div className="flex gap-2">
            <input className={input} placeholder="Buscar nome, código, local…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <button className={btn + " bg-primary text-primary-foreground"} onClick={() => setForm({ p: vazio() })}>＋</button>
          </div>
          <div className="flex gap-2">
            {(["todos", "baixo", "vencendo"] as const).map((f) => <button key={f} onClick={() => setFiltro(f)} className={chip + (filtro === f ? " bg-primary text-primary-foreground" : " bg-muted")}>{f === "todos" ? "Todos" : f === "baixo" ? "Estoque baixo" : "Vencendo"}</button>)}
            <button className={chip + " ml-auto bg-muted"} onClick={() => baixar("estoque.csv", csv([["codigo", "nome", "categoria", "local", "lote", "qtd", "minimo", "preco", "validade"], ...d.produtos.map((p) => [p.codigo, p.nome, p.categoria, p.local, p.lote, p.qtd, p.min, p.preco, p.validade])]), "text/csv")}>⬇ CSV</button>
          </div>
          <div className={desk ? "grid grid-cols-2 gap-4 xl:grid-cols-3" : "space-y-4"}>
          {lista.map((p) => (
            <div key={p.codigo} className={card}>
              <div className="flex justify-between gap-2"><b>{p.nome}</b><span className={p.qtd < p.min ? "font-bold text-destructive" : "font-bold"}>{p.qtd} un</span></div>
              <p className="text-xs text-muted-foreground">📍 {p.local || "—"} · {p.categoria || "Sem categoria"} · Lote {p.lote || "—"}</p>
              <p className="text-xs text-muted-foreground">Cód. {p.codigo} · {p.validade ? `Val. ${br(p.validade)}` : "Sem validade"} · Mín. {p.min} · {moeda(p.preco)}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button className={btn + " bg-primary text-primary-foreground"} onClick={() => abrirCodigo(p.codigo)}>Movimentar</button>
                <button className={btn + " bg-muted"} onClick={() => setForm({ p: { ...p }, orig: p.codigo })}>Editar</button>
              </div>
            </div>
          ))}
          </div>
          {!lista.length && <p className="text-center text-sm text-muted-foreground">Nenhum produto encontrado.</p>}
        </>)}

        {(aba === "pedidos" || aba === "entregas") && (<>
          {aba === "pedidos" && <button className={btn + " w-full bg-primary text-primary-foreground"} onClick={() => setNovoPed(ped("", "", "", add(1), "Separando", []))}>＋ Novo pedido</button>}
          <div className={desk ? "grid grid-cols-2 gap-4 xl:grid-cols-3" : "space-y-4"}>
          {d.pedidos.filter((p) => (aba === "pedidos" ? ["Separando", "Conferido"] : ["Em rota", "Entregue", "Atrasada"]).includes(p.status)).map((p) => (
            <button key={p.id} onClick={() => setPedSel(p.id)} className={card + " block w-full text-left"}>
              <div className="flex items-center justify-between"><b>{p.id}</b><span className={chip + " " + cores[atrasado(p) && p.status !== "Entregue" ? "Atrasada" : p.status]}>{atrasado(p) && p.status === "Em rota" ? "Atrasada" : p.status}</span></div>
              <p className="text-sm">{p.cliente}</p>
              <p className="text-xs text-muted-foreground">Prazo {br(p.prazo)} · {p.itens.length} item(ns){p.motorista ? ` · 🚚 ${p.motorista}` : ""}</p>
              {aba === "pedidos" && <div className="mt-2 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-success" style={{ width: `${(p.check.filter(Boolean).length / CHECK.length) * 100}%` }} /></div>}
            </button>
          ))}
          </div>
        </>)}

        {aba === "historico" && (<>
          <div className="flex flex-wrap gap-2">
            {tipos.map((t) => <button key={t} onClick={() => setHistF(t)} className={chip + (histF === t ? " bg-primary text-primary-foreground" : " bg-muted")}>{t}</button>)}
          </div>
          <div className={card}>{d.hist.filter((h) => histF === "Todos" || h.tipo === histF).map((h, i) => <div key={i} className="border-b py-2 text-sm last:border-0"><span className="text-xs text-muted-foreground">{h.data} · {h.tipo}</span><p>{h.texto}</p></div>)}</div>
          <div className="grid grid-cols-2 gap-2">
            <button className={btn + " bg-muted"} onClick={() => baixar("historico.csv", csv([["data", "tipo", "descricao"], ...d.hist.map((h) => [h.data, h.tipo, h.texto])]), "text/csv")}>⬇ Exportar CSV</button>
            <button className={btn + " bg-muted"} onClick={() => baixar("backup-logicontrol.json", JSON.stringify(d), "application/json")}>💾 Backup</button>
            <label className={btn + " cursor-pointer bg-muted text-center"}>📂 Restaurar backup<input type="file" accept=".json" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) try { salvar(JSON.parse(await f.text()), "Sistema", "Backup restaurado"); avisar("Backup restaurado"); } catch { avisar("Arquivo inválido"); } }} /></label>
            <button className={btn + " bg-muted text-destructive"} onClick={() => confirm("Apagar tudo e voltar aos dados de exemplo?") && salvar(exemplo())}>↺ Dados de exemplo</button>
          </div>
        </>)}
      </main>

      {movP && (() => { const p = prod(movP.codigo) ?? movP; return (
        <Sheet titulo={p.nome} onClose={() => setMovP(null)}>
          <p className="text-sm text-muted-foreground">📍 {p.local} · Estoque atual: <b className="text-foreground">{p.qtd} un</b></p>
          <Campo r="Quantidade">
            <div className="flex items-center gap-2">
              <button className={btn + " bg-muted text-lg"} onClick={() => setMovQ(Math.max(0, movQ - 1))}>−</button>
              <input className={input + " text-center text-lg font-bold"} type="number" min={0} value={movQ} onChange={(e) => setMovQ(Math.max(0, +e.target.value))} />
              <button className={btn + " bg-muted text-lg"} onClick={() => setMovQ(movQ + 1)}>＋</button>
            </div>
          </Campo>
          <Campo r="Observação (opcional)"><input className={input} placeholder="Ex: NF 1234, fornecedor…" value={movObs} onChange={(e) => setMovObs(e.target.value)} /></Campo>
          <div className="grid grid-cols-2 gap-2">
            <button disabled={!movQ} className={btn + " bg-success text-primary-foreground"} onClick={() => mover("Entrada")}>⬇ Entrada</button>
            <button disabled={!movQ} className={btn + " bg-secondary text-secondary-foreground"} onClick={() => mover("Saída")}>⬆ Saída</button>
            <button disabled={!movQ} className={btn + " bg-destructive text-destructive-foreground"} onClick={() => mover("Avaria")}>⚠ Avaria/perda</button>
            <button className={btn + " bg-muted"} onClick={() => mover("Ajuste")}>📋 Inventário (= {movQ})</button>
          </div>
        </Sheet>); })()}

      {form && (
        <Sheet titulo={form.orig ? "Editar produto" : "Novo produto"} onClose={() => setForm(null)}>
          <Campo r="Código de barras / QR"><div className="flex gap-2"><input className={input} value={form.p.codigo} onChange={(e) => setForm({ ...form, p: { ...form.p, codigo: e.target.value } })} /><button aria-label="Ler com a câmera" className={btn + " bg-primary text-primary-foreground"} onClick={() => setCam(() => (c: string) => setForm((f) => f && { ...f, p: { ...f.p, codigo: c } }))}>📷</button></div></Campo>
          <Campo r="Nome"><input className={input} value={form.p.nome} onChange={(e) => setForm({ ...form, p: { ...form.p, nome: e.target.value } })} /></Campo>
          <div className="grid grid-cols-2 gap-2">
            <Campo r="Categoria"><input className={input} value={form.p.categoria} onChange={(e) => setForm({ ...form, p: { ...form.p, categoria: e.target.value } })} /></Campo>
            <Campo r="Localização"><input className={input} placeholder="A-01-02" value={form.p.local} onChange={(e) => setForm({ ...form, p: { ...form.p, local: e.target.value.toUpperCase() } })} /></Campo>
            <Campo r="Lote"><input className={input} value={form.p.lote} onChange={(e) => setForm({ ...form, p: { ...form.p, lote: e.target.value } })} /></Campo>
            <Campo r="Validade"><input className={input} type="date" value={form.p.validade} onChange={(e) => setForm({ ...form, p: { ...form.p, validade: e.target.value } })} /></Campo>
            <Campo r="Quantidade"><input className={input} type="number" min={0} value={form.p.qtd} onChange={(e) => setForm({ ...form, p: { ...form.p, qtd: Math.max(0, +e.target.value) } })} /></Campo>
            <Campo r="Estoque mínimo"><input className={input} type="number" min={0} value={form.p.min} onChange={(e) => setForm({ ...form, p: { ...form.p, min: Math.max(0, +e.target.value) } })} /></Campo>
            <Campo r="Preço unitário (R$)"><input className={input} type="number" min={0} step="0.01" value={form.p.preco} onChange={(e) => setForm({ ...form, p: { ...form.p, preco: Math.max(0, +e.target.value) } })} /></Campo>
          </div>
          <button className={btn + " w-full bg-primary text-primary-foreground"} onClick={salvarProd}>Salvar</button>
          {form.orig && <button className={btn + " w-full bg-muted text-destructive"} onClick={() => { if (confirm("Excluir este produto?")) { salvar({ ...d, produtos: d.produtos.filter((x) => x.codigo !== form.orig) }, "Cadastro", `Produto excluído: ${form.p.nome}`); setForm(null); } }}>Excluir produto</button>}
        </Sheet>
      )}

      {novoPed && (
        <Sheet titulo="Novo pedido" onClose={() => setNovoPed(null)}>
          <Campo r="Cliente"><input className={input} value={novoPed.cliente} onChange={(e) => setNovoPed({ ...novoPed, cliente: e.target.value })} /></Campo>
          <Campo r="Endereço de entrega"><input className={input} value={novoPed.endereco} onChange={(e) => setNovoPed({ ...novoPed, endereco: e.target.value })} /></Campo>
          <div className="grid grid-cols-2 gap-2">
            <Campo r="Prazo"><input className={input} type="date" value={novoPed.prazo} onChange={(e) => setNovoPed({ ...novoPed, prazo: e.target.value })} /></Campo>
            <Campo r="Motorista"><input className={input} value={novoPed.motorista} onChange={(e) => setNovoPed({ ...novoPed, motorista: e.target.value })} /></Campo>
          </div>
          <Campo r="Itens">
            <div className="space-y-2">
              {novoPed.itens.map((it, i) => (
                <div key={i} className="flex gap-2">
                  <select className={input} value={it.codigo} onChange={(e) => setNovoPed({ ...novoPed, itens: novoPed.itens.map((x, j) => (j === i ? { ...x, codigo: e.target.value } : x)) })}>
                    {d.produtos.map((p) => <option key={p.codigo} value={p.codigo}>{p.nome} ({p.qtd})</option>)}
                  </select>
                  <input className={input + " w-20"} type="number" min={1} value={it.qtd} onChange={(e) => setNovoPed({ ...novoPed, itens: novoPed.itens.map((x, j) => (j === i ? { ...x, qtd: Math.max(1, +e.target.value) } : x)) })} />
                  <button aria-label="Remover item" className="px-2 text-destructive" onClick={() => setNovoPed({ ...novoPed, itens: novoPed.itens.filter((_, j) => j !== i) })}>×</button>
                </div>
              ))}
              <button disabled={!d.produtos.length} className={btn + " w-full bg-muted"} onClick={() => setNovoPed({ ...novoPed, itens: [...novoPed.itens, { codigo: d.produtos[0]?.codigo ?? "", qtd: 1 }] })}>＋ Adicionar item</button>
            </div>
          </Campo>
          <button disabled={!novoPed.cliente || !novoPed.itens.length} className={btn + " w-full bg-primary text-primary-foreground"} onClick={() => {
            const id = "PED-" + (Math.max(1000, ...d.pedidos.map((x) => +x.id.slice(4) || 0)) + 1);
            salvar({ ...d, pedidos: [{ ...novoPed, id }, ...d.pedidos] }, "Pedido", `Pedido ${id} criado para ${novoPed.cliente}`);
            setNovoPed(null); setAba("pedidos"); avisar(`${id} criado`);
          }}>Criar pedido</button>
        </Sheet>
      )}

      {sel && (
        <Sheet titulo={`${sel.id} · ${sel.cliente}`} onClose={() => setPedSel(null)}>
          <p className="text-sm">📍 {sel.endereco || "Sem endereço"} · Prazo {br(sel.prazo)}</p>
          {sel.endereco && <a className="text-sm font-semibold text-primary underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(sel.endereco)}`}>Abrir rota no mapa</a>}
          <div className={card + " space-y-1"}>
            {sel.itens.map((i) => <p key={i.codigo} className="text-sm">{i.qtd} × {prod(i.codigo)?.nome ?? i.codigo} <span className="text-xs text-muted-foreground">({prod(i.codigo)?.local})</span></p>)}
          </div>
          {(sel.status === "Separando" || sel.status === "Conferido") && (<>
            <h3 className="font-bold">Checklist de conferência</h3>
            {CHECK.map((c, i) => (
              <label key={c} className="flex items-center gap-3 text-sm">
                <input type="checkbox" className="h-5 w-5 accent-secondary" checked={sel.check[i] ?? false} onChange={() => { const check = sel.check.map((x, j) => (j === i ? !x : x)); setPed(sel.id, (p) => ({ ...p, check, status: check.every(Boolean) ? "Conferido" : "Separando" }), "Conferência", `${sel.id}: ${c} ${sel.check[i] ? "desmarcado" : "ok"}`); }} />{c}
              </label>
            ))}
            <button className={btn + " w-full bg-muted"} onClick={() => setCam(() => (c: string) => avisar(sel.itens.some((i) => i.codigo === c) ? `✔ ${prod(c)?.nome} pertence ao pedido` : "✖ Produto NÃO pertence a este pedido"))}>📷 Conferir item pela câmera</button>
            <Campo r="Motorista"><input className={input} value={sel.motorista} onChange={(e) => setD({ ...d, pedidos: d.pedidos.map((p) => (p.id === sel.id ? { ...p, motorista: e.target.value } : p)) })} onBlur={() => salvar(d)} /></Campo>
            <button disabled={sel.status !== "Conferido"} className={btn + " w-full bg-primary text-primary-foreground"} onClick={() => liberar(sel)}>Liberar para envio</button>
            <button className={btn + " w-full bg-muted text-destructive"} onClick={() => { if (confirm("Cancelar este pedido?")) { salvar({ ...d, pedidos: d.pedidos.filter((p) => p.id !== sel.id) }, "Pedido", `${sel.id} cancelado`); setPedSel(null); } }}>Cancelar pedido</button>
          </>)}
          {(sel.status === "Em rota" || sel.status === "Atrasada") && (<>
            <Campo r="Nome de quem recebeu"><input className={input} value={sel.recebedor} onChange={(e) => setD({ ...d, pedidos: d.pedidos.map((p) => (p.id === sel.id ? { ...p, recebedor: e.target.value } : p)) })} /></Campo>
            <button disabled={!sel.recebedor} className={btn + " w-full bg-success text-primary-foreground"} onClick={() => { setPed(sel.id, (p) => ({ ...p, status: "Entregue" }), "Entrega", `${sel.id} entregue a ${sel.recebedor}`); setPedSel(null); avisar("Entrega confirmada"); }}>✔ Confirmar entrega</button>
            <div className="grid grid-cols-2 gap-2">
              {["Cliente ausente", "Endereço não encontrado", "Avaria no transporte", "Trânsito / atraso"].map((o) => (
                <button key={o} className={btn + " bg-muted text-xs"} onClick={() => setPed(sel.id, (p) => ({ ...p, status: "Atrasada", ocorrencias: [...p.ocorrencias, `${new Date().toLocaleString("pt-BR")} — ${o}`] }), "Ocorrência", `${sel.id}: ${o}`)}>{o}</button>
              ))}
            </div>
          </>)}
          {sel.status === "Entregue" && <p className="text-sm">✔ Recebido por <b>{sel.recebedor}</b></p>}
          {!!sel.ocorrencias.length && <div className="text-xs text-muted-foreground">{sel.ocorrencias.map((o) => <p key={o}>⚠ {o}</p>)}</div>}
        </Sheet>
      )}

      {cam && <Suspense fallback={null}><Scanner onClose={() => setCam(null)} onRead={(c) => cam(c)} /></Suspense>}
      {aviso && <div className="fixed inset-x-0 bottom-20 z-50 mx-auto w-fit max-w-[90%] rounded-xl bg-foreground px-4 py-2 text-sm text-background shadow-lg">{aviso}</div>}

      <nav className={desk ? "fixed inset-y-0 left-0 z-30 flex w-64 flex-col gap-1 border-r bg-card p-4 pt-28" : "fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md justify-around border-t bg-card py-2"}>
        {([["inicio", "🏠", "Início"], ["estoque", "📦", "Estoque"], ["pedidos", "✅", "Pedidos"], ["entregas", "🚚", "Entregas"], ["historico", "🕘", "Histórico"]] as const).map(([k, i, t]) => (
          <button key={k} onClick={() => setAba(k)} className={(desk ? "flex items-center gap-3 rounded-xl px-4 py-3 text-sm " + (aba === k ? "bg-muted " : "") : "flex flex-col items-center px-2 text-xs ") + (aba === k ? "font-bold text-primary" : "text-muted-foreground")}><span className="text-xl">{i}</span>{t}</button>
        ))}
      </nav>
    </div>
  );
}
