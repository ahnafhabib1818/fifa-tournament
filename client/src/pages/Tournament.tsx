import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronRight, CircleHelp, Flag, Medal, Pencil, Save, Shield, Sparkles, Trophy, Users } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  computeStandings,
  generateKnockoutFixtures,
  recordMatchScore,
  selectQualifiers,
  type Fixture,
  type Standing,
  type Team,
  type TournamentState,
} from "../../../shared/tournament";

type TabKey = "fixtures" | "table" | "bracket";

const friendlyDate = (value: Date | string) => new Intl.DateTimeFormat("bn-BD", {
  day: "numeric", month: "long", year: "numeric",
}).format(new Date(value));

function formatName(state: TournamentState) {
  if (state.format.type === "direct-knockout") return "সরাসরি নকআউট";
  if (state.format.type === "groups") return `${state.format.groupCount} গ্রুপ · ${state.format.qualifiersPerGroup} দল উঠবে`;
  if (state.format.progression.type === "none") return "একক পয়েন্ট টেবিল";
  if (state.format.progression.type === "top-2-final") return "শীর্ষ ২ · ফাইনাল";
  if (state.format.progression.type === "top-4-semifinal") return "শীর্ষ ৪ · সেমিফাইনাল";
  return `শীর্ষ ${state.format.progression.qualifierCount} · নকআউট`;
}

function allStageFixturesDone(state: TournamentState, stage: Fixture["stage"]) {
  const fixtures = state.fixtures.filter((fixture) => fixture.stage === stage);
  return fixtures.length > 0 && fixtures.every((fixture) => fixture.status === "completed" || fixture.status === "bye");
}

function latestKnockoutRound(state: TournamentState) {
  const rounds = state.fixtures.filter((fixture) => fixture.stage === "knockout").map((fixture) => fixture.round);
  return rounds.length ? Math.max(...rounds) : 0;
}

function knockoutChampion(state: TournamentState): Team | undefined {
  const round = latestKnockoutRound(state);
  if (!round) return undefined;
  const matches = state.fixtures.filter((fixture) => fixture.stage === "knockout" && fixture.round === round);
  if (matches.length !== 1 || !matches[0].winnerTeamId) return undefined;
  return state.teams.find((team) => team.id === matches[0].winnerTeamId);
}

export default function TournamentPage({ id }: { id: string }) {
  const [tab, setTab] = useState<TabKey>("fixtures");
  const utils = trpc.useUtils();
  const query = trpc.tournament.get.useQuery({ id });
  const save = trpc.tournament.update.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.tournament.get.invalidate({ id }), utils.tournament.list.invalidate()]);
      toast.success("স্কোর ও টুর্নামেন্ট সেভ হয়েছে");
    },
    onError: (error) => {
      toast.error(error.message);
      void Promise.all([utils.tournament.get.invalidate({ id }), utils.tournament.list.invalidate()]);
    },
  });

  if (query.isLoading) return <div className="page-loading"><span className="spinner" /> টুর্নামেন্ট খুলছে…</div>;
  if (query.isError) return <div className="page-loading error-page"><CircleHelp size={26} /><strong>টুর্নামেন্টটি খোলা যায়নি</strong><button className="button button-outline" onClick={() => query.refetch()}>আবার চেষ্টা</button><Link className="back-link" href="/">আর্কাইভে ফিরো</Link></div>;
  if (!query.data) return <div className="page-loading error-page"><CircleHelp size={26} /><strong>এই টুর্নামেন্টটি পাওয়া যায়নি</strong><Link className="button button-green" href="/">আর্কাইভে ফিরো</Link></div>;

  const record = query.data;
  const state = record.state;
  const teamById = new Map(state.teams.map((team) => [team.id, team]));
  const hasKnockout = state.fixtures.some((fixture) => fixture.stage === "knockout");
  const round = latestKnockoutRound(state);
  const currentKnockoutFixtures = state.fixtures.filter((fixture) => fixture.stage === "knockout" && fixture.round === round);
  const canStartFromLeague = state.format.type === "league" && state.format.progression.type !== "none" && !hasKnockout && allStageFixturesDone(state, "league");
  const canStartFromGroups = state.format.type === "groups" && !hasKnockout && allStageFixturesDone(state, "group");
  const canCreateNextRound = hasKnockout && currentKnockoutFixtures.length > 0 && currentKnockoutFixtures.every((fixture) => fixture.status === "completed" || fixture.status === "bye") && currentKnockoutFixtures.some((fixture) => fixture.winnerTeamId) && new Set(currentKnockoutFixtures.map((fixture) => fixture.winnerTeamId).filter(Boolean)).size > 1;
  const champion = knockoutChampion(state) ?? (state.format.type === "league" && state.format.progression.type === "none" && allStageFixturesDone(state, "league")
    ? teamById.get(computeStandings(state.teams, state.fixtures, { stage: "league" })[0]?.teamId ?? "")
    : undefined);

  const persist = (next: TournamentState) => save.mutate({ id, version: record.version, state: next });
  const editFixture = (fixture: Fixture, homeTeamId: string, awayTeamId: string): boolean => {
    if (homeTeamId === awayTeamId) {
      toast.error("একটি দল একই ম্যাচে নিজের বিপক্ষে খেলতে পারে না।");
      return false;
    }
    const pairKey = [homeTeamId, awayTeamId].sort().join("|");
    const duplicate = state.fixtures.some((item) => item.id !== fixture.id && item.stage === fixture.stage && item.groupId === fixture.groupId && (fixture.stage !== "knockout" || item.round === fixture.round) && item.homeTeamId && item.awayTeamId && [item.homeTeamId, item.awayTeamId].sort().join("|") === pairKey);
    if (duplicate) {
      toast.error("এই দুই দলের ম্যাচ ফিক্সচারে আগে থেকেই আছে।");
      return false;
    }
    const retained = state.fixtures.filter((item) => fixture.stage === "knockout"
      ? item.stage !== "knockout" || item.round <= fixture.round
      : item.stage !== "knockout");
    persist({ ...state, fixtures: retained.map((item) => item.id === fixture.id ? {
      ...item,
      homeTeamId,
      awayTeamId,
      homeScore: null,
      awayScore: null,
      homePenaltyScore: undefined,
      awayPenaltyScore: undefined,
      winnerTeamId: undefined,
      status: "scheduled",
    } : item) });
    return true;
  };
  const saveFixture = (fixture: Fixture, home: number, away: number, homePens?: number, awayPens?: number) => {
    try {
      const withoutFuture = fixture.stage === "knockout"
        ? { ...state, fixtures: state.fixtures.filter((item) => item.stage !== "knockout" || item.round <= fixture.round) }
        : { ...state, fixtures: state.fixtures.filter((item) => item.stage !== "knockout") };
      const next = recordMatchScore(withoutFuture, fixture.id, home, away,
        home === away && homePens !== undefined && awayPens !== undefined ? { home: homePens, away: awayPens } : undefined);
      persist(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "স্কোর সেভ করা যায়নি");
    }
  };

  const advance = () => {
    try {
      let newFixtures: Fixture[];
      if (!hasKnockout) {
        const qualifiers = selectQualifiers(state);
        if (qualifiers.length < 2) return toast.error("নকআউট শুরু করতে অন্তত দুইটি দল লাগবে।");
        newFixtures = generateKnockoutFixtures(qualifiers);
      } else {
        const winners = currentKnockoutFixtures
          .map((fixture) => fixture.winnerTeamId ? teamById.get(fixture.winnerTeamId) : undefined)
          .filter((team): team is Team => Boolean(team));
        if (winners.length < 2) return;
        const nextRound = round + 1;
        newFixtures = generateKnockoutFixtures(winners).map((fixture, index) => ({
          ...fixture,
          id: `knockout-r${nextRound}-m${index + 1}`,
          round: nextRound,
        }));
      }
      persist({ ...state, fixtures: [...state.fixtures, ...newFixtures] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "পরের পর্ব তৈরি করা যায়নি");
    }
  };

  const fixturesByStage = {
    league: state.fixtures.filter((fixture) => fixture.stage === "league"),
    group: state.fixtures.filter((fixture) => fixture.stage === "group"),
    knockout: state.fixtures.filter((fixture) => fixture.stage === "knockout"),
  };
  const totalMatches = state.fixtures.filter((fixture) => fixture.status !== "bye").length;
  const playedMatches = state.fixtures.filter((fixture) => fixture.status === "completed").length;
  const progress = totalMatches ? Math.round((playedMatches / totalMatches) * 100) : 0;

  return <div className="app-shell">
    <aside className="side-rail"><Link href="/" className="brand-mark" aria-label="Kickoff home"><span className="ball-mark">◉</span></Link><nav className="rail-nav"><Link className="rail-item" href="/" aria-label="আর্কাইভ"><span className="rail-icon">⌂</span></Link><a className="rail-item active" href="#fixtures" aria-label="ফিক্সচার"><Trophy size={18} /></a></nav><div className="rail-bottom"><span className="avatar-mini">F</span></div></aside>
    <main className="main-canvas">
      <header className="topbar"><div className="wordmark"><span className="wordmark-ball">◉</span><span>KICKOFF<span className="wordmark-dot">.</span></span><span className="wordmark-tag">FRIENDS LEAGUE</span></div><div className="topbar-right"><span className="live-dot" /><span className="shared-label">শেয়ার্ড আর্কাইভ</span><button className="avatar-button" title="বন্ধুদের টুর্নামেন্ট">F</button></div></header>
      <div className="page-content tournament-content">
        <Link href="/" className="back-link"><ArrowLeft size={16} /> সব টুর্নামেন্ট</Link>
        <section className="tournament-hero">
          <div className="tournament-hero-left"><div className="eyebrow"><span className="eyebrow-line" /> TOURNAMENT / {state.id.slice(0, 6).toUpperCase()}</div><h1>{state.name}</h1><div className="tournament-meta"><span><CalendarDays size={15} /> {friendlyDate(record.createdAt)}</span><span><Users size={15} /> {state.teams.length} দল</span><span className="format-badge">{formatName(state)}</span></div></div>
          <div className="progress-wheel"><div className="progress-wheel-inner"><strong>{progress}%</strong><span>খেলা</span></div><span className="progress-caption">{playedMatches} / {totalMatches} ম্যাচ</span></div>
          <div className="tournament-hero-pitch"><span className="hero-pitch-word">MATCHDAY</span><div className="mini-pitch-circle" /><div className="mini-pitch-line" /><Trophy className="pitch-trophy" size={26} /></div>
        </section>

        {champion && <section className="champion-banner"><div className="champion-cup"><Trophy size={24} /></div><div><span>TOURNAMENT CHAMPION</span><strong>{champion.name}</strong></div><div className="champion-stars">★ ★ ★</div></section>}

        <section className="detail-section" id="fixtures">
          <div className="detail-heading"><div><div className="eyebrow dark-eyebrow"><span className="eyebrow-line" /> YOUR MATCHDAY</div><h2>টুর্নামেন্ট বোর্ড</h2></div><div className="detail-actions"><span className="autosave-note"><Shield size={15} /> প্রতিটি স্কোর সেভ হয়</span></div></div>
          <div className="detail-tabs" role="tablist" aria-label="টুর্নামেন্ট ভিউ">
            <button className={tab === "fixtures" ? "active" : ""} onClick={() => setTab("fixtures")} role="tab"><CalendarDays size={16} /> ফিক্সচার <span>{totalMatches}</span></button>
            <button className={tab === "table" ? "active" : ""} onClick={() => setTab("table")} role="tab"><Medal size={16} /> পয়েন্ট টেবিল</button>
            {hasKnockout && <button className={tab === "bracket" ? "active" : ""} onClick={() => setTab("bracket")} role="tab"><Trophy size={16} /> নকআউট ব্র্যাকেট</button>}
          </div>

          {tab === "fixtures" && <div className="fixtures-view">
            {fixturesByStage.league.length > 0 && <FixtureStageSection title="লিগ পর্ব" note="সব দল একে অপরের মুখোমুখি" fixtures={fixturesByStage.league} teams={teamById} availableTeams={state.teams} saving={save.isPending} onSave={saveFixture} onEdit={editFixture} />}
            {fixturesByStage.group.length > 0 && state.groups.map((group) => <FixtureStageSection key={group.id} title={group.name} note={`${group.teamIds.length} দল · গ্রুপ পর্ব`} fixtures={fixturesByStage.group.filter((fixture) => fixture.groupId === group.id)} teams={teamById} availableTeams={group.teamIds.map((teamId) => teamById.get(teamId)!).filter(Boolean)} saving={save.isPending} onSave={saveFixture} onEdit={editFixture} />)}
            {fixturesByStage.knockout.length > 0 && <FixtureStageSection title="নকআউট পর্ব" note="জয়ী দল পরের রাউন্ডে" fixtures={fixturesByStage.knockout} teams={teamById} availableTeams={state.teams} saving={save.isPending} onSave={saveFixture} onEdit={editFixture} knockout />}
            {fixturesByStage.league.length === 0 && fixturesByStage.group.length === 0 && fixturesByStage.knockout.length === 0 && <div className="empty-panel">এখনও কোনো ফিক্সচার নেই।</div>}
          </div>}

          {tab === "table" && <div className="tables-view">
            {state.format.type === "groups" ? state.groups.map((group) => <StandingsTable key={group.id} title={group.name} standings={computeStandings(group.teamIds.map((teamId) => teamById.get(teamId)!).filter(Boolean), state.fixtures, { stage: "group", groupId: group.id })} />)
              : state.format.type === "league" ? <StandingsTable title="লিগ টেবিল" standings={computeStandings(state.teams, state.fixtures, { stage: "league" })} />
                : <div className="bracket-hint"><Trophy size={24} /><strong>সরাসরি নকআউট</strong><span>পয়েন্ট টেবিল নেই—জিতলেই পরের রাউন্ড।</span><button className="text-button" onClick={() => setTab("bracket")}>ব্র্যাকেট দেখো <ArrowRight size={15} /></button></div>}
          </div>}

          {tab === "bracket" && <div className="bracket-view">
            {fixturesByStage.knockout.length === 0 ? <div className="bracket-hint"><Flag size={24} /><strong>এখনও নকআউট শুরু হয়নি</strong><span>পয়েন্ট টেবিলের সব ম্যাচ শেষ হলে তোমরা বাছাইপর্ব শুরু করতে পারবে।</span></div> : <div className="bracket-rounds">{Array.from(new Set(fixturesByStage.knockout.map((fixture) => fixture.round))).sort((a, b) => a - b).map((roundNo) => <div className="bracket-round" key={roundNo}><div className="bracket-round-title"><span>ROUND {String(roundNo).padStart(2, "0")}</span><strong>{roundNo === 1 ? "প্রথম রাউন্ড" : roundNo === latestKnockoutRound(state) && fixturesByStage.knockout.filter((fixture) => fixture.round === roundNo).length === 1 ? "ফাইনাল" : `${roundNo}য় রাউন্ড`}</strong></div>{fixturesByStage.knockout.filter((fixture) => fixture.round === roundNo).map((fixture) => <BracketMatch key={fixture.id} fixture={fixture} teams={teamById} />)}</div>)}</div>}
          </div>}

          {(canStartFromLeague || canStartFromGroups) && <div className="advance-panel"><div className="advance-icon"><Sparkles size={18} /></div><div><strong>লিগ পর্ব শেষ—এবার নকআউট!</strong><span>তোমাদের বেছে নেওয়া নিয়ম অনুযায়ী সেরা দলগুলো এগোবে।</span></div><button className="button button-green" onClick={advance} disabled={save.isPending}>নকআউট তৈরি করো <ArrowRight size={16} /></button></div>}
          {canCreateNextRound && <div className="advance-panel"><div className="advance-icon"><Trophy size={18} /></div><div><strong>পরের রাউন্ডের সময়</strong><span>সব ম্যাচের ফল এসেছে—জয়ীদের নিয়ে পরের fixture বানাও।</span></div><button className="button button-green" onClick={advance} disabled={save.isPending}>পরের রাউন্ড তৈরি <ArrowRight size={16} /></button></div>}
        </section>
        <footer className="page-footer"><span>MADE FOR FRIENDS. BUILT FOR MATCHDAY.</span><span><span className="footer-ball">◉</span> KEEP THE SCORE, KEEP THE STORY.</span></footer>
      </div>
    </main>
  </div>;
}

function FixtureStageSection({ title, note, fixtures, teams, availableTeams, saving, onSave, onEdit, knockout = false }: {
  title: string;
  note: string;
  fixtures: Fixture[];
  teams: Map<string, Team>;
  availableTeams: Team[];
  saving: boolean;
  onSave: (fixture: Fixture, home: number, away: number, homePens?: number, awayPens?: number) => void;
  onEdit: (fixture: Fixture, homeTeamId: string, awayTeamId: string) => boolean;
  knockout?: boolean;
}) {
  const rounds = useMemo(() => [...new Set(fixtures.map((fixture) => fixture.round))].sort((a, b) => a - b), [fixtures]);
  return <section className="fixture-stage"><div className="fixture-stage-heading"><div><h3>{title}</h3><span>{note}</span></div><span className="stage-count">{fixtures.filter((fixture) => fixture.status !== "bye").length} MATCHES</span></div>
    {rounds.map((round) => <div className="fixture-round" key={round}><div className="round-label"><span>ROUND {String(round).padStart(2, "0")}</span><i /></div><div className="match-list">{fixtures.filter((fixture) => fixture.round === round).map((fixture) => <MatchCard key={fixture.id} fixture={fixture} teams={teams} availableTeams={availableTeams} saving={saving} onSave={onSave} onEdit={onEdit} knockout={knockout} />)}</div></div>)}
  </section>;
}

function MatchCard({ fixture, teams, availableTeams, saving, onSave, onEdit, knockout }: {
  fixture: Fixture;
  teams: Map<string, Team>;
  availableTeams: Team[];
  saving: boolean;
  onSave: (fixture: Fixture, home: number, away: number, homePens?: number, awayPens?: number) => void;
  onEdit: (fixture: Fixture, homeTeamId: string, awayTeamId: string) => boolean;
  knockout: boolean;
}) {
  const homeTeam = fixture.byeTeamId ? teams.get(fixture.byeTeamId) : teams.get(fixture.homeTeamId ?? "");
  const awayTeam = teams.get(fixture.awayTeamId ?? "");
  const [home, setHome] = useState(fixture.homeScore?.toString() ?? "");
  const [away, setAway] = useState(fixture.awayScore?.toString() ?? "");
  const [homePens, setHomePens] = useState(fixture.homePenaltyScore?.toString() ?? "");
  const [awayPens, setAwayPens] = useState(fixture.awayPenaltyScore?.toString() ?? "");
  const [editing, setEditing] = useState(false);
  const [editHome, setEditHome] = useState(fixture.homeTeamId ?? "");
  const [editAway, setEditAway] = useState(fixture.awayTeamId ?? "");
  useEffect(() => {
    setHome(fixture.homeScore?.toString() ?? "");
    setAway(fixture.awayScore?.toString() ?? "");
    setHomePens(fixture.homePenaltyScore?.toString() ?? "");
    setAwayPens(fixture.awayPenaltyScore?.toString() ?? "");
    setEditHome(fixture.homeTeamId ?? "");
    setEditAway(fixture.awayTeamId ?? "");
  }, [fixture.homeTeamId, fixture.awayTeamId, fixture.homeScore, fixture.awayScore, fixture.homePenaltyScore, fixture.awayPenaltyScore]);
  if (fixture.status === "bye") return <div className="bye-card"><span className="bye-icon">BYE</span><span><strong>{homeTeam?.name ?? "একটি দল"}</strong> এই রাউন্ডে বাই পেয়ে এগিয়ে গেছে</span><Check size={16} /></div>;
  const tied = knockout && home !== "" && away !== "" && Number(home) === Number(away);
  const winner = fixture.winnerTeamId ? teams.get(fixture.winnerTeamId) : undefined;
  return <div className={`match-card ${fixture.status === "completed" ? "match-completed" : ""}`}>
    <div className="match-teams"><div className={`match-team ${winner?.id === homeTeam?.id ? "team-winner" : ""}`}><span className="team-crest">{homeTeam?.name.slice(0, 1) ?? "?"}</span><strong>{homeTeam?.name ?? "TBD"}</strong></div><div className="score-slash">VS</div><div className={`match-team away-team ${winner?.id === awayTeam?.id ? "team-winner" : ""}`}><strong>{awayTeam?.name ?? "TBD"}</strong><span className="team-crest">{awayTeam?.name.slice(0, 1) ?? "?"}</span></div></div>
    <div className="score-entry"><input aria-label={`${homeTeam?.name} গোল`} type="number" min="0" max="99" value={home} onChange={(event) => setHome(event.target.value)} placeholder="–" /><span>:</span><input aria-label={`${awayTeam?.name} গোল`} type="number" min="0" max="99" value={away} onChange={(event) => setAway(event.target.value)} placeholder="–" /><button className="score-save" disabled={saving || home === "" || away === "" || (tied && (homePens === "" || awayPens === ""))} onClick={() => onSave(fixture, Number(home), Number(away), homePens === "" ? undefined : Number(homePens), awayPens === "" ? undefined : Number(awayPens))} title="স্কোর সেভ করো"><Save size={16} /></button></div>
    <div className="match-actionsline"><div className="match-state">{fixture.status === "completed" ? <><span className="completed-dot" /> ফল সেভ হয়েছে</> : <><span className="scheduled-dot" /> স্কোর দাও</>}</div><button className="fixture-edit-toggle" onClick={() => { setEditHome(fixture.homeTeamId ?? ""); setEditAway(fixture.awayTeamId ?? ""); setEditing(!editing); }}><Pencil size={12} /> ফিক্সচার বদল</button></div>
    {editing && <div className="fixture-edit-row"><select value={editHome} onChange={(event) => setEditHome(event.target.value)} aria-label="হোম টিম বদলাও">{availableTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select><span>vs</span><select value={editAway} onChange={(event) => setEditAway(event.target.value)} aria-label="অ্যাওয়ে টিম বদলাও">{availableTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select><button disabled={saving || editHome === editAway} onClick={() => { if (onEdit(fixture, editHome, editAway)) setEditing(false); }}>সেভ</button></div>}
    {tied && <div className="penalty-row"><span>PEN</span><input aria-label="হোম পেনাল্টি" type="number" min="0" max="99" value={homePens} onChange={(event) => setHomePens(event.target.value)} placeholder="–" /><span>:</span><input aria-label="অ্যাওয়ে পেনাল্টি" type="number" min="0" max="99" value={awayPens} onChange={(event) => setAwayPens(event.target.value)} placeholder="–" /><small>পেনাল্টি দিয়ে বিজয়ী ঠিক করো</small></div>}
  </div>;
}

function StandingsTable({ title, standings }: { title: string; standings: Standing[] }) {
  return <section className="standings-card"><div className="standings-heading"><div><div className="eyebrow dark-eyebrow"><span className="eyebrow-line" /> LEAGUE TABLE</div><h3>{title}</h3></div><span className="points-key">জয় ৩ · ড্র ১ · হার ০</span></div><div className="table-scroll"><table className="standings-table"><thead><tr><th>#</th><th>টিম</th><th>MP</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>PTS</th></tr></thead><tbody>{standings.map((standing, index) => <tr key={standing.teamId} className={index < 2 ? "qualify-row" : ""}><td><span className={`rank-number ${index === 0 ? "rank-first" : ""}`}>{String(index + 1).padStart(2, "0")}</span></td><td className="table-team"><span className="team-crest small-crest">{standing.teamName.slice(0, 1)}</span><strong>{standing.teamName}</strong>{index < 2 && <span className="qualify-mark" title="বর্তমানে যোগ্যতার জায়গায়">↑</span>}</td><td>{standing.played}</td><td>{standing.wins}</td><td>{standing.draws}</td><td>{standing.losses}</td><td>{standing.goalsFor}</td><td>{standing.goalsAgainst}</td><td className={standing.goalDifference > 0 ? "positive-gd" : ""}>{standing.goalDifference > 0 ? `+${standing.goalDifference}` : standing.goalDifference}</td><td><strong>{standing.points}</strong></td></tr>)}</tbody></table></div><div className="table-footnote"><span><i /> বর্তমানে কোয়ালিফাইং পজিশন</span><span>সমান পয়েন্টে: GD → GF → H2H</span></div></section>;
}

function BracketMatch({ fixture, teams }: { fixture: Fixture; teams: Map<string, Team> }) {
  const home = fixture.byeTeamId ? teams.get(fixture.byeTeamId) : teams.get(fixture.homeTeamId ?? "");
  const away = teams.get(fixture.awayTeamId ?? "");
  const winner = fixture.winnerTeamId;
  return <div className="bracket-match"><div className={winner === home?.id ? "bracket-winner" : ""}><span>{home?.name ?? "TBD"}</span><strong>{fixture.homeScore ?? (fixture.status === "bye" ? "BYE" : "–")}</strong></div>{fixture.status !== "bye" && <div className={winner === away?.id ? "bracket-winner" : ""}><span>{away?.name ?? "TBD"}</span><strong>{fixture.awayScore ?? "–"}</strong></div>}</div>;
}
