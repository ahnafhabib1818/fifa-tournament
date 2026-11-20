import { useMemo, useState, type FormEvent } from "react";
import { ArrowDownRight, ArrowRight, CalendarDays, Check, ChevronDown, CircleHelp, Clock3, Plus, Sparkles, Trophy, Users, X } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { LeagueProgression, TournamentFormat } from "../../../shared/tournament";

const clubOptions = [
  "Real Madrid", "Barcelona", "Manchester City", "Liverpool", "Arsenal", "Chelsea",
  "Manchester United", "Tottenham Hotspur", "Bayern Munich", "Borussia Dortmund",
  "Paris Saint-Germain", "Inter Milan", "AC Milan", "Juventus", "Napoli",
  "Atletico Madrid", "Boca Juniors", "Al Hilal", "Brazil", "Argentina",
];

const formatName = (format: TournamentFormat): string => {
  if (format.type === "direct-knockout") return "সরাসরি নকআউট";
  if (format.type === "groups") return `${format.groupCount} গ্রুপ · প্রতি গ্রুপের সেরা ${format.qualifiersPerGroup}`;
  if (format.progression.type === "none") return "একক লিগ";
  if (format.progression.type === "top-2-final") return "লিগ + টপ ২ ফাইনাল";
  if (format.progression.type === "top-4-semifinal") return "লিগ + টপ ৪ সেমিফাইনাল";
  return `লিগ + টপ ${format.progression.qualifierCount} নকআউট`;
};

const friendlyDate = (value: Date | string) => new Intl.DateTimeFormat("bn-BD", {
  day: "numeric", month: "short", year: "numeric",
}).format(new Date(value));

export default function Home() {
  const [createOpen, setCreateOpen] = useState(false);
  const tournaments = trpc.tournament.list.useQuery();
  const activeCount = tournaments.data?.filter((item) => item.status !== "completed").length ?? 0;
  const teamTotal = useMemo(() => tournaments.data?.reduce((sum, item) => sum + item.state.teams.length, 0) ?? 0, [tournaments.data]);

  return (
    <div className="app-shell">
      <aside className="side-rail">
        <Link href="/" className="brand-mark" aria-label="Kickoff home"><span className="ball-mark">◉</span></Link>
        <nav className="rail-nav" aria-label="প্রধান নেভিগেশন">
          <a className="rail-item active" href="#home" aria-label="হোম"><span className="rail-icon">⌂</span></a>
          <a className="rail-item" href="#archive" aria-label="আর্কাইভ"><Trophy size={18} /></a>
        </nav>
        <div className="rail-bottom"><span className="avatar-mini">F</span></div>
      </aside>

      <main className="main-canvas" id="home">
        <header className="topbar">
          <div className="wordmark"><span className="wordmark-ball">◉</span><span>KICKOFF<span className="wordmark-dot">.</span></span><span className="wordmark-tag">FRIENDS LEAGUE</span></div>
          <div className="topbar-right"><span className="live-dot" /> <span className="shared-label">শেয়ার্ড আর্কাইভ</span><button className="avatar-button" title="বন্ধুদের টুর্নামেন্ট">F</button></div>
        </header>

        <div className="page-content">
          <section className="hero-panel">
            <div className="hero-copy">
              <div className="eyebrow"><span className="eyebrow-line" /> MATCHDAY STARTS HERE</div>
              <h1>মাঠ প্রস্তুত?<br /><span>খেলা হোক।</span></h1>
              <p>বন্ধুদের FIFA রাতের ফিক্সচার, স্কোর আর গল্প—সব এক জায়গায়।</p>
              <button className="button button-lime hero-cta" onClick={() => setCreateOpen(true)}><Plus size={18} /> নতুন টুর্নামেন্ট <ArrowRight size={16} /></button>
            </div>
            <div className="hero-field" aria-hidden="true">
              <div className="field-half-line" /><div className="field-circle" /><div className="field-dot" />
              <div className="field-corner field-corner-one" /><div className="field-corner field-corner-two" />
              <div className="hero-stamp"><span>FIFA</span><strong>FRIENDS<br />CUP</strong><small>EST. EVERY MATCHDAY</small></div>
              <div className="hero-bottom-note"><span>THE NEXT LEGEND</span><ArrowDownRight size={14} /></div>
            </div>
            <div className="hero-meta"><span>01 / YOUR TOURNAMENT HUB</span><span>PLAY · TRACK · REMEMBER</span></div>
          </section>

          <section className="stats-row" aria-label="টুর্নামেন্ট সারাংশ">
            <div className="stat-card"><div className="stat-icon"><Trophy size={17} /></div><div><span className="stat-label">মোট টুর্নামেন্ট</span><strong>{tournaments.isLoading ? "—" : String(tournaments.data?.length ?? 0).padStart(2, "0")}</strong></div><span className="stat-foot">সব স্মৃতি একসাথে</span></div>
            <div className="stat-card"><div className="stat-icon stat-icon-live"><span className="live-dot" /></div><div><span className="stat-label">চলছে এখন</span><strong>{tournaments.isLoading ? "—" : String(activeCount).padStart(2, "0")}</strong></div><span className="stat-foot">MATCHES IN PLAY</span></div>
            <div className="stat-card"><div className="stat-icon"><Users size={17} /></div><div><span className="stat-label">দল খেলেছে</span><strong>{tournaments.isLoading ? "—" : String(teamTotal).padStart(2, "0")}</strong></div><span className="stat-foot">সব টুর্নামেন্ট মিলিয়ে</span></div>
          </section>

          <section className="archive-section" id="archive">
            <div className="section-heading">
              <div><div className="eyebrow dark-eyebrow"><span className="eyebrow-line" /> THE ARCHIVE</div><h2>তোমাদের টুর্নামেন্ট</h2><p>প্রতিটি ম্যাচ, প্রতিটি স্মৃতি—এখানে থেকে যাবে।</p></div>
              <button className="button button-outline" onClick={() => setCreateOpen(true)}><Plus size={17} /> টুর্নামেন্ট বানাও</button>
            </div>

            {tournaments.isLoading && <div className="loading-panel"><span className="spinner" /> আর্কাইভ খোলা হচ্ছে…</div>}
            {tournaments.isError && <div className="empty-panel error-panel"><CircleHelp size={22} /><div><strong>আর্কাইভ লোড হয়নি</strong><span>ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করো।</span></div><button className="text-button" onClick={() => tournaments.refetch()}>আবার চেষ্টা</button></div>}
            {tournaments.isSuccess && tournaments.data.length === 0 && <div className="empty-panel"><div className="empty-ball">◉</div><div><strong>প্রথম ম্যাচের গল্পটা শুরু করো</strong><span>একটা নতুন টুর্নামেন্ট তৈরি করলেই তোমাদের আর্কাইভ তৈরি হবে।</span></div><button className="button button-lime" onClick={() => setCreateOpen(true)}><Plus size={16} /> প্রথম টুর্নামেন্ট</button></div>}
            {!!tournaments.data?.length && <div className="tournament-grid">
              {tournaments.data.map((item, index) => <Link className="tournament-card" href={`/t/${item.id}`} key={item.id}>
                <div className={`card-top-stripe stripe-${index % 4}`} />
                <div className="card-kicker"><span className="card-index">CUP / {String(index + 1).padStart(2, "0")}</span><span className={`status-pill ${item.status === "completed" ? "status-complete" : ""}`}><i />{item.status === "completed" ? "শেষ হয়েছে" : "চলছে"}</span></div>
                <h3>{item.name}</h3>
                <div className="card-format"><span className="format-ball">◉</span>{formatName(item.state.format)}</div>
                <div className="team-chip-row">{item.state.teams.slice(0, 4).map((team) => <span className="team-chip" key={team.id}>{team.name}</span>)}{item.state.teams.length > 4 && <span className="team-chip more-chip">+{item.state.teams.length - 4}</span>}</div>
                <div className="card-footer"><span><CalendarDays size={14} /> {friendlyDate(item.createdAt)}</span><span><Users size={14} /> {item.state.teams.length} দল</span><span className="card-arrow"><ArrowRight size={17} /></span></div>
              </Link>)}
            </div>}
          </section>
          <footer className="page-footer"><span>MADE FOR FRIENDS. BUILT FOR MATCHDAY.</span><span><span className="footer-ball">◉</span> KEEP THE SCORE, KEEP THE STORY.</span></footer>
        </div>
      </main>

      {createOpen && <CreateTournamentModal onClose={() => setCreateOpen(false)} onCreated={(id) => { setCreateOpen(false); window.location.href = `/t/${id}`; }} />}
    </div>
  );
}

function CreateTournamentModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [teamCount, setTeamCount] = useState(4);
  const [names, setNames] = useState(["", "", "", ""]);
  const [formatType, setFormatType] = useState<TournamentFormat["type"] | null>(null);
  const [progressionType, setProgressionType] = useState<LeagueProgression["type"] | null>(null);
  const [qualifierCount, setQualifierCount] = useState(4);
  const [groupCount, setGroupCount] = useState(2);
  const [qualifiersPerGroup, setQualifiersPerGroup] = useState(2);
  const [formError, setFormError] = useState("");
  const create = trpc.tournament.create.useMutation({
    onSuccess: (record) => {
      if (!record) return;
      toast.success("টুর্নামেন্ট আর্কাইভে সেভ হয়েছে");
      onCreated(record.id);
    },
    onError: (error) => setFormError(error.message),
  });

  const changeCount = (value: number) => {
    const count = Math.min(32, Math.max(2, value || 2));
    setTeamCount(count);
    setNames((old) => Array.from({ length: count }, (_, index) => old[index] ?? ""));
  };
  const setTeamName = (index: number, value: string) => setNames((old) => old.map((item, i) => i === index ? value : item));
  const selectedFormat = (): TournamentFormat | null => {
    if (!formatType) return null;
    if (formatType === "direct-knockout") return { type: "direct-knockout" };
    if (formatType === "groups") return { type: "groups", groupCount, qualifiersPerGroup };
    if (progressionType === null) return null;
    const progression: LeagueProgression = progressionType === "custom"
      ? { type: "custom", qualifierCount }
      : progressionType === "none" ? { type: "none" }
        : progressionType === "top-2-final" ? { type: "top-2-final" }
          : { type: "top-4-semifinal" };
    return { type: "league", progression };
  };
  const format = selectedFormat();
  const preview = format ? formatName(format) : "";

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    const cleanNames = names.slice(0, teamCount).map((value) => value.trim());
    if (!name.trim()) return setFormError("টুর্নামেন্টের একটা নাম দাও।");
    if (cleanNames.some((teamName) => !teamName)) return setFormError("প্রতিটি দলের নাম বেছে নাও বা লিখে দাও।");
    if (new Set(cleanNames.map((teamName) => teamName.toLocaleLowerCase())).size !== cleanNames.length) return setFormError("একই দলের নাম একাধিকবার আছে—নামগুলো আলাদা করো।");
    if (!formatType) return setFormError("টুর্নামেন্টের ফরম্যাট বেছে নাও।");
    if (formatType === "league" && progressionType === null) return setFormError("লিগের পরে কী হবে, সেটি বেছে নাও।");
    if (formatType === "league" && progressionType === "top-4-semifinal" && teamCount < 4) return setFormError("শীর্ষ ৪ সেমিফাইনালের জন্য অন্তত ৪টি দল লাগবে।");
    if (formatType === "league" && progressionType === "custom" && (qualifierCount < 2 || qualifierCount > teamCount)) return setFormError("কোয়ালিফাই করা দলের সংখ্যা ২ থেকে মোট দলের সংখ্যার মধ্যে রাখো।");
    if (formatType === "groups" && groupCount > Math.floor(teamCount / 2)) return setFormError("গ্রুপ পর্বে প্রতিটি গ্রুপে কমপক্ষে ২টি দল দরকার। দলের সংখ্যা বাড়াও বা অন্য ফরম্যাট বেছে নাও।");
    if (formatType === "groups" && qualifiersPerGroup > Math.floor(teamCount / groupCount)) return setFormError("প্রতি গ্রুপে যতটি দল আছে, তার চেয়ে বেশি দল কোয়ালিফাই করতে পারবে না।");
    const formatToCreate = selectedFormat();
    if (!formatToCreate) return setFormError("ফরম্যাটের প্রয়োজনীয় নিয়মগুলো বেছে নাও।");
    create.mutate({
      name: name.trim(),
      teams: cleanNames.map((teamName, index) => ({ id: `team-${index + 1}`, name: teamName })),
      format: formatToCreate,
    });
  };

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="create-modal" role="dialog" aria-modal="true" aria-labelledby="create-title">
      <div className="modal-top"><div><div className="eyebrow dark-eyebrow"><span className="eyebrow-line" /> NEW MATCHDAY</div><h2 id="create-title">নতুন টুর্নামেন্ট</h2><p>তোমাদের নিয়মে সাজাও—ফরম্যাট তোমরাই ঠিক করবে।</p></div><button className="icon-button" onClick={onClose} aria-label="বন্ধ করো"><X size={20} /></button></div>
      <form onSubmit={submit} className="setup-form">
        <label className="field-label">টুর্নামেন্টের নাম<input className="text-input" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="যেমন: শুক্রবারের FIFA কাপ" autoFocus /></label>
        <div className="field-row align-end"><label className="field-label team-count-field">কয়টি টিম খেলবে?<div className="stepper"><button type="button" onClick={() => changeCount(teamCount - 1)} aria-label="দলের সংখ্যা কমাও">−</button><input type="number" value={teamCount} min={2} max={32} onChange={(event) => changeCount(Number(event.target.value))} /><button type="button" onClick={() => changeCount(teamCount + 1)} aria-label="দলের সংখ্যা বাড়াও">+</button></div></label><span className="helper-copy">২ থেকে ৩২টি দল</span></div>
        <div className="team-input-heading"><span className="field-label">টিম সিলেক্ট করো বা নাম লেখো</span><span>{teamCount} টি নাম লাগবে</span></div>
        <datalist id="club-suggestions">{clubOptions.map((club) => <option value={club} key={club} />)}</datalist>
        <div className="team-input-grid">{Array.from({ length: teamCount }, (_, index) => <label className="team-input-row" key={index}><span>{String(index + 1).padStart(2, "0")}</span><input list="club-suggestions" value={names[index] ?? ""} onChange={(event) => setTeamName(index, event.target.value)} placeholder={`টিম ${index + 1} বেছে নাও / লিখো`} aria-label={`টিম ${index + 1}`} /></label>)}</div>

        <div className="field-label format-label">টুর্নামেন্টের ফরম্যাট বেছে নাও</div>
        <div className="format-choice-grid">
          <button type="button" className={`format-choice ${formatType === "league" ? "selected" : ""}`} onClick={() => setFormatType("league")}><span className="choice-check">{formatType === "league" && <Check size={13} />}</span><span className="choice-icon">01</span><strong>একক লিগ</strong><small>সবাই সবার বিপক্ষে খেলবে</small></button>
          <button type="button" className={`format-choice ${formatType === "groups" ? "selected" : ""}`} onClick={() => setFormatType("groups")}><span className="choice-check">{formatType === "groups" && <Check size={13} />}</span><span className="choice-icon">02</span><strong>গ্রুপ + নকআউট</strong><small>{teamCount < 4 ? "গ্রুপে অন্তত ৪টি দল লাগবে" : "গ্রুপ পর্ব শেষে বাছাই"}</small></button>
          <button type="button" className={`format-choice ${formatType === "direct-knockout" ? "selected" : ""}`} onClick={() => setFormatType("direct-knockout")}><span className="choice-check">{formatType === "direct-knockout" && <Check size={13} />}</span><span className="choice-icon">03</span><strong>সরাসরি নকআউট</strong><small>হারলেই বিদায়</small></button>
        </div>

        {formatType === "league" && <div className="format-options"><label className="field-label">লিগের পরে কী হবে?<select className="select-input" value={progressionType ?? ""} onChange={(event) => setProgressionType(event.target.value ? event.target.value as LeagueProgression["type"] : null)}><option value="">পরের ধাপ বেছে নাও</option><option value="none">শুধু পয়েন্ট টেবিল — নকআউট নেই</option><option value="top-2-final">শীর্ষ ২ দল ফাইনাল</option><option value="top-4-semifinal">শীর্ষ ৪ দল সেমিফাইনাল</option><option value="custom">নিজে ঠিক করব — শীর্ষ N দল</option></select></label>{progressionType === "custom" && <label className="field-label compact-label">কয় দল নকআউটে উঠবে?<input className="text-input small-number" type="number" value={qualifierCount} min={2} max={teamCount} onChange={(event) => setQualifierCount(Number(event.target.value))} /></label>}</div>}
        {formatType === "groups" && <div className="format-options two-options"><label className="field-label">কয়টি গ্রুপ?<input className="text-input small-number" type="number" value={groupCount} min={2} max={Math.min(16, Math.floor(teamCount / 2))} onChange={(event) => setGroupCount(Number(event.target.value))} /></label><label className="field-label">প্রতি গ্রুপ থেকে কয় দল উঠবে?<input className="text-input small-number" type="number" value={qualifiersPerGroup} min={1} max={Math.floor(teamCount / groupCount)} onChange={(event) => setQualifiersPerGroup(Number(event.target.value))} /></label></div>}
        {format && formatType !== "direct-knockout" && <div className="format-preview"><Sparkles size={15} /><span>তোমাদের বেছে নেওয়া সেটিং:</span><strong>{preview}</strong></div>}
        {formError && <div className="form-error">{formError}</div>}
        <div className="modal-actions"><span><Clock3 size={15} /> তৈরি হলেই আর্কাইভে সেভ হবে</span><button className="button button-green" type="submit" disabled={create.isPending}>{create.isPending ? <><span className="spinner light-spinner" /> সেভ হচ্ছে…</> : <>ফিক্সচার তৈরি করো <ArrowRight size={16} /></>}</button></div>
      </form>
    </section>
  </div>;
}
