import { useEffect, useMemo, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { filterWorks, latestMock, recentCategoryAverages, sortCompletedWorks } from "./domain/ielts";
import { ieltsApi } from "./services/ieltsApi";
import type { IeltsCategory, IeltsData, IeltsMock, IeltsScores, IeltsWork } from "./types/ielts";
import "./Ielts.css";

const labels: Record<IeltsCategory, string> = { reading: "阅读", listening: "听力", writing: "写作", speaking: "口语" };
const emptyData: IeltsData = { goal: null, works: [], mocks: [] };
const nowLocal = () => { const date = new Date(); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16); };

function ScoreRing({ label, score, target }: { label: string; score: number | null; target?: number }) {
  const value = score ?? 0;
  return <div className="score-card"><div className="score-ring" style={{ "--score": `${value / 9 * 360}deg` } as React.CSSProperties}><div><strong>{score ?? "—"}</strong><small>/ 9</small></div></div><b>{label}</b>{target != null && <span>目标 {target}</span>}</div>;
}

function GoalPage({ data, refresh }: { data: IeltsData; refresh: () => Promise<void> }) {
  const recent = latestMock(data.mocks), averages = recentCategoryAverages(data.works);
  const [editing, setEditing] = useState(false), [form, setForm] = useState<IeltsScores>(data.goal ?? { reading: 7, listening: 7, writing: 6.5, speaking: 6.5 });
  const save = async () => { await ieltsApi.saveGoal(form); setEditing(false); await refresh(); };
  return <><div className="ielts-heading"><div><span>GOAL OVERVIEW</span><h2>目标汇总</h2></div><button className="ghost" onClick={() => setEditing(!editing)}>{editing ? "取消" : "设置目标"}</button></div>{editing && <div className="panel score-form">{Object.entries(labels).map(([key,label]) => <label key={key}>{label}<input type="number" min="0" max="9" step="0.5" value={form[key as IeltsCategory]} onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}/></label>)}<button className="primary" onClick={() => void save()}>保存目标</button></div>}
    <h3 className="metric-title">最近一次模考</h3><div className="score-grid">{Object.entries(labels).map(([key,label]) => <ScoreRing key={key} label={label} score={recent?.[key as IeltsCategory] ?? null} target={data.goal?.[key as IeltsCategory]}/>)}</div>
    <h3 className="metric-title">近期作业平均 · 每科最近 5 次</h3><div className="score-grid compact">{Object.entries(labels).map(([key,label]) => <ScoreRing key={key} label={label} score={averages[key as IeltsCategory]} target={data.goal?.[key as IeltsCategory]}/>)}</div></>;
}

function WorkCircle({ work, onComplete }: { work: IeltsWork; onComplete?: (work: IeltsWork) => void }) {
  return <button data-category={work.category} className={`work-orbit ${work.completedAt ? "completed" : ""}`} onClick={() => onComplete?.(work)}><span className="orbit-date">截止 {work.dueAt?.replace("T", " ") ?? "未设置"}</span><span className="work-circle"><strong>{work.name}</strong><small>{labels[work.category]}</small>{work.completedAt && <><b>{work.score} 分</b><em>实际 {work.actualMinutes} 分钟</em></>}</span><span className="orbit-time">应使用 {work.expectedMinutes ?? "—"} 分钟</span></button>;
}

function HomeworkPage({ data, refresh }: { data: IeltsData; refresh: () => Promise<void> }) {
  const [adding, setAdding] = useState(false), [completing, setCompleting] = useState<IeltsWork | null>(null);
  const [category, setCategory] = useState<IeltsCategory | "all">("all");
  const [form, setForm] = useState({ name: "", category: "reading" as IeltsCategory, dueAt: "", expectedMinutes: 60 });
  const [result, setResult] = useState({ actualMinutes: 60, score: 6.5, parts: [0,0,0,0] });
  const pending = filterWorks(data.works.filter((work) => !work.completedAt), category);
  const completed = filterWorks(sortCompletedWorks(data.works), category);
  const add = async () => { await ieltsApi.createWork({ ...form, dueAt: form.dueAt || null, expectedMinutes: form.expectedMinutes || null }); setAdding(false); await refresh(); };
  const complete = async () => { if (!completing) return; await ieltsApi.completeWork(completing.recordId, { actualMinutes: result.actualMinutes, score: result.score, readingCorrect: completing.category === "reading" ? result.parts.slice(0,3) : null, listeningCorrect: completing.category === "listening" ? result.parts.slice(0,4) : null }); setCompleting(null); await refresh(); };
  return <><div className="ielts-heading"><div><span>HOMEWORK & PRACTICE</span><h2>作业与自测</h2></div><button className="primary" onClick={() => setAdding(true)}>＋ 添加作业</button></div><div className="category-filters"><button className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}>全部</button>{Object.entries(labels).map(([key,label])=><button data-category={key} className={category === key ? "active" : ""} onClick={() => setCategory(key as IeltsCategory)} key={key}>{label}</button>)}</div><h3 className="work-section-title">未完成</h3><div className="work-grid">{pending.length ? pending.map((work) => <WorkCircle key={work.recordId} work={work} onComplete={setCompleting}/>) : <p className="ielts-empty">暂无待完成作业</p>}</div><h3 className="work-section-title completed-title">已完成</h3><div className="work-grid">{completed.length ? completed.map((work) => <WorkCircle key={work.recordId} work={work}/>) : <p className="ielts-empty">还没有完成记录</p>}</div>
    {adding && <div className="ielts-dialog panel"><h3>新增雅思作业</h3><label>名称<input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/></label><label>科目<select value={form.category} onChange={(e)=>setForm({...form,category:e.target.value as IeltsCategory})}>{Object.entries(labels).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label><label>截止时间<input type="datetime-local" value={form.dueAt} onChange={(e)=>setForm({...form,dueAt:e.target.value})}/></label><label>预计完成时间（分钟）<input type="number" value={form.expectedMinutes} onChange={(e)=>setForm({...form,expectedMinutes:Number(e.target.value)})}/></label><div><button className="ghost" onClick={()=>setAdding(false)}>取消</button><button className="primary" disabled={!form.name.trim()} onClick={()=>void add()}>保存</button></div></div>}
    {completing && <div className="ielts-dialog panel"><h3>完成「{completing.name}」</h3><label>完成时间（分钟）<input type="number" min="1" value={result.actualMinutes} onChange={(e)=>setResult({...result,actualMinutes:Number(e.target.value)})}/></label><label>本次分数（0–9）<input type="number" min="0" max="9" step="0.5" value={result.score} onChange={(e)=>setResult({...result,score:Number(e.target.value)})}/></label>{completing.category === "reading" && <div className="parts"><span>三篇阅读答对题数</span>{[0,1,2].map(i=><input key={i} type="number" min="0" value={result.parts[i]} onChange={(e)=>{const parts=[...result.parts];parts[i]=Number(e.target.value);setResult({...result,parts})}}/>)}</div>}{completing.category === "listening" && <div className="parts"><span>四个听力部分答对题数</span>{[0,1,2,3].map(i=><input key={i} type="number" min="0" value={result.parts[i]} onChange={(e)=>{const parts=[...result.parts];parts[i]=Number(e.target.value);setResult({...result,parts})}}/>)}</div>}<div><button className="ghost" onClick={()=>setCompleting(null)}>取消</button><button className="primary" onClick={()=>void complete()}>确认完成</button></div></div>}
  </>;
}

function IeltsCoursesPage() {
  return <><div className="ielts-heading"><div><span>IELTS COURSES</span><h2>课程</h2></div></div><p className="ielts-intro">按四个科目集中查看和安排学习内容。</p><div className="ielts-course-grid">{Object.entries(labels).map(([key,label])=><article className="panel ielts-course-card" data-category={key} key={key}><span>{label.slice(0,1)}</span><div><strong>{label}课程</strong><small>课程内容将在后续添加到这里</small></div></article>)}</div></>;
}

function MockPage({ data, refresh }: { data: IeltsData; refresh: () => Promise<void> }) {
  const [form,setForm]=useState<Omit<IeltsMock,"recordId"|"createdAt"|"updatedAt">>({examAt:nowLocal(),reading:6.5,listening:6.5,writing:6,speaking:6,notes:""});
  const save=async()=>{await ieltsApi.createMock(form);await refresh()};
  return <><div className="ielts-heading"><div><span>MOCK EXAMS</span><h2>手动模考</h2></div></div><section className="panel mock-form"><label>模考时间<input type="datetime-local" value={form.examAt} onChange={e=>setForm({...form,examAt:e.target.value})}/></label>{Object.entries(labels).map(([key,label])=><label key={key}>{label}分数<input type="number" min="0" max="9" step="0.5" value={form[key as IeltsCategory]} onChange={e=>setForm({...form,[key]:Number(e.target.value)})}/></label>)}<label className="mock-notes">备注<input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label><button className="primary" onClick={()=>void save()}>保存模考</button></section><h3 className="metric-title">历史模考</h3><div className="mock-history">{[...data.mocks].sort((a,b)=>b.examAt.localeCompare(a.examAt)).map(mock=><div className="panel mock-row" key={mock.recordId}><strong>{mock.examAt.replace("T"," ")}</strong>{Object.entries(labels).map(([key,label])=><span key={key}>{label} {mock[key as IeltsCategory]}</span>)}</div>)}</div></>;
}

export default function IeltsPage() {
  const [data,setData]=useState<IeltsData>(emptyData),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const refresh=async()=>{try{setData(await ieltsApi.get());setError("")}catch(reason){setError(reason instanceof Error?reason.message:"读取雅思数据失败")}finally{setLoading(false)}};
  useEffect(()=>{void refresh()},[]);
  const props=useMemo(()=>({data,refresh}),[data]);
  return <div className="page ielts-page"><header className="page-header"><div><p className="eyebrow">IELTS</p><h1>雅思</h1><p>目标、作业、课程和模考成绩。</p></div></header><div className="ielts-workspace"><nav className="ielts-tabs"><NavLink to="/ielts" end>目标</NavLink><NavLink to="/ielts/homework">作业与自测</NavLink><NavLink to="/ielts/courses">课程</NavLink><NavLink to="/ielts/mocks">历史模考成绩</NavLink></nav><section className="ielts-content">{error&&<p className="form-error">{error}</p>}{loading?<p className="ielts-empty">正在读取…</p>:<Routes><Route index element={<GoalPage {...props}/>} /><Route path="homework" element={<HomeworkPage {...props}/>} /><Route path="courses" element={<IeltsCoursesPage/>} /><Route path="mocks" element={<MockPage {...props}/>} /></Routes>}</section></div></div>;
}
