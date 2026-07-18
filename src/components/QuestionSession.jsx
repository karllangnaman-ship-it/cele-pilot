import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { firebaseApi } from "@/api/firebaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import RemoteFigure from "@/components/RemoteFigure";
import SituationViewer from "@/components/SituationViewer";
import { LatexText } from "@/components/LatexFormula";
import { buildQuestionSession } from "@/lib/questionSessionOrder";

const subjects = ["all", "PSAD", "MSTE", "HGE"];
const counts = [10, 20, 30, 50, 75, 100];
const mockCounts = [50, 100, 150, 200];
const limits = [{ value: "none", label: "None" }, { value: "30", label: "30 min" }, { value: "60", label: "1 hour" }, { value: "120", label: "2 hours" }, { value: "custom", label: "Custom" }];
const sameAnswer = (question, answer) => {
  const correct = String(question.correctAnswer || "").trim();
  const letter = Number(correct.charCodeAt(0)) - 65;
  return String(answer || "").trim().toLowerCase() === correct.toLowerCase() || question.choices?.[letter] === answer;
};
const minuteText = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export default function QuestionSession({ exam = false }) {
  const location = useLocation();
  const { toast } = useToast();
  const [user, setUser] = useState(null); const [active, setActive] = useState(null); const [answers, setAnswers] = useState({}); const [submitted, setSubmitted] = useState(false); const [startedAt, setStartedAt] = useState(null); const [elapsed, setElapsed] = useState(0); const finishing = useRef(false);
  const [settings, setSettings] = useState(() => ({ subject: exam ? "all" : "all", topic: "", subtopic: "", questionType: "all", difficulty: "mixed", questionOrder: "original", situationOrder: "original", withinSituation: "original", count: exam ? 50 : 10, customCount: "", timeLimit: "none", customLimit: "", collection: "all" }));
  useEffect(() => { firebaseApi.auth.me().then(setUser).catch(() => {}); }, []);
  useEffect(() => { if (!startedAt || submitted) return undefined; const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000); return () => clearInterval(timer); }, [startedAt, submitted]);
  const selected = useMemo(() => active?.flatMap((unit) => unit.questions) || [], [active]);
  const update = (key, value) => setSettings((old) => ({ ...old, [key]: value }));
  const targetCount = Number(settings.customCount || settings.count);
  const limitSeconds = settings.timeLimit === "custom" ? Number(settings.customLimit || 0) * 60 : Number(settings.timeLimit || 0) * 60;
  const start = async () => {
    if (!user) return;
    let all = await firebaseApi.entities.Question.filter({ user_id: user.id });
    const situations = await firebaseApi.entities.Situation.filter({ user_id: user.id });
    const retake = location.state?.questions;
    if (Array.isArray(retake) && retake.length) all = retake;
    if (settings.collection === "wrong") {
      const notes = await firebaseApi.entities.MistakeNotebook.filter({ user_id: user.id });
      const ids = new Set(notes.map((note) => note.questionId)); all = all.filter((item) => ids.has(item.id));
    }
    all = all.filter((item) => (settings.subject === "all" || item.subject === settings.subject) && (!settings.topic || String(item.topic || "").toLowerCase().includes(settings.topic.toLowerCase())) && (!settings.subtopic || String(item.subtopic || "").toLowerCase().includes(settings.subtopic.toLowerCase())) && (settings.questionType === "all" || (settings.questionType === "situation" ? Boolean(item.situationId) : !item.situationId)) && (settings.difficulty === "mixed" || String(item.difficulty || "").toLowerCase() === settings.difficulty) && (settings.collection !== "past-board" || /^Past Board/i.test(item.questionSource || "")) && (settings.collection !== "ai" || item.sourceType === "ai" || item.questionSource === "AI Generated") && (settings.collection !== "manual" || item.sourceType === "manual" || item.questionSource === "Manual"));
    if (!all.length) return toast({ title: "No questions match these selections", variant: "destructive" });
    setActive(buildQuestionSession(all, situations, { count: targetCount, shuffleQuestions: settings.questionOrder === "shuffle" || settings.situationOrder === "shuffle", shuffleWithinSituation: settings.withinSituation === "shuffle" })); setAnswers({}); setSubmitted(false); finishing.current = false; setStartedAt(Date.now()); setElapsed(0);
  };
  const finish = async () => {
    if (!user || submitted || finishing.current) return;
    finishing.current = true;
    const endedAt = new Date().toISOString(); const correct = selected.filter((q, i) => sameAnswer(q, answers[i])).length; const skipped = selected.filter((_, i) => !answers[i]).length;
    const questions = selected.map((question, index) => ({ ...question, userAnswer: answers[index] || "", result: !answers[index] ? "skipped" : sameAnswer(question, answers[index]) ? "correct" : "wrong" }));
    const record = { user_id: user.id, examType: exam ? "mock_board" : "practice", date: startedAt ? new Date(startedAt).toISOString() : endedAt, timeStarted: startedAt ? new Date(startedAt).toISOString() : endedAt, timeFinished: endedAt, durationSeconds: elapsed, subject: settings.subject, topic: settings.topic || null, subtopic: settings.subtopic || null, questionCount: selected.length, correct, wrong: selected.length - correct - skipped, skipped, score: correct, percentage: selected.length ? Math.round((correct / selected.length) * 100) : 0, passed: selected.length ? correct / selected.length >= 0.7 : false, settings, questions };
    await firebaseApi.entities.ExamHistory.create(record);
    await firebaseApi.entities.UserQuestionHistory.bulkCreate(questions.map((question) => ({ user_id: user.id, questionId: question.id, selectedAnswer: question.userAnswer, isCorrect: question.result === "correct", mode: exam ? "mock_exam" : "practice" })));
    const misses = questions.filter((question) => question.result === "wrong");
    await Promise.all(misses.map(async (question) => {
      const existing = (await firebaseApi.entities.MistakeNotebook.filter({ user_id: user.id, questionId: question.id }))[0];
      const payload = { user_id: user.id, questionId: question.id, question, userWrongAnswer: question.userAnswer, correctAnswer: question.correctAnswer, explanation: question.explanation || "", solution: question.solution || "", dateIncorrect: endedAt, timesMissed: Number(existing?.timesMissed || 0) + 1, questionSource: question.questionSource || null, topic: question.topic || "", subtopic: question.subtopic || "" };
      if (existing) await firebaseApi.entities.MistakeNotebook.update(existing.id, payload); else await firebaseApi.entities.MistakeNotebook.create(payload);
    }));
    setSubmitted(true);
  };
  useEffect(() => { if (active && limitSeconds && elapsed >= limitSeconds && !submitted) finish(); }, [active, elapsed, limitSeconds, submitted]);
  const Question = ({ question, index }) => <article className="rounded-lg border bg-background/40 p-3"><div className="flex justify-between gap-2"><p className="font-medium">{index + 1}. <LatexText value={question.question} /></p>{question.questionSource && <span className="text-xs text-muted-foreground">Source: {question.questionSource}</span>}</div>{question.imageUrl && <RemoteFigure url={question.imageUrl} label={question.figureLabel || "Question figure"} />}<RadioGroup value={answers[index] || ""} onValueChange={(value) => setAnswers((old) => ({ ...old, [index]: value }))} disabled={submitted} className="mt-2 grid gap-1.5">{(question.choices || []).map((choice, choiceIndex) => <div className="flex items-center gap-2" key={choiceIndex}><RadioGroupItem value={choice} id={`${question.id}-${index}-${choiceIndex}`} /><Label htmlFor={`${question.id}-${index}-${choiceIndex}`}>{String.fromCharCode(65 + choiceIndex)}. <LatexText value={choice} /></Label></div>)}</RadioGroup>{submitted && <div className="mt-3 text-sm"><p className={sameAnswer(question, answers[index]) ? "text-emerald-600" : "text-destructive"}>{!answers[index] ? "Skipped" : sameAnswer(question, answers[index]) ? "Correct" : "Wrong"} · Correct answer: <LatexText value={question.correctAnswer} /></p>{question.explanation && <p className="mt-1 text-muted-foreground"><LatexText value={question.explanation} /></p>}{question.solution && <p className="mt-1 text-muted-foreground"><LatexText value={question.solution} /></p>}</div>}</article>;
  if (!active) return <div className="space-y-4"><div><h1 className="text-2xl font-bold">{exam ? "Mock Board Exam" : "Practice Mode"}</h1><p className="text-sm text-muted-foreground">Configure the session before you begin.</p></div><div className="glass-card grid gap-4 p-4 md:grid-cols-2"><Field label="Subject"><Select value={settings.subject} onValueChange={(v) => update("subject", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{subjects.map((v) => <SelectItem key={v} value={v}>{v === "all" ? "All Subjects" : v}</SelectItem>)}</SelectContent></Select></Field>{!exam && <><Field label="Topic (optional)"><Input value={settings.topic} onChange={(e) => update("topic", e.target.value)} /></Field><Field label="Sub Topic (optional)"><Input value={settings.subtopic} onChange={(e) => update("subtopic", e.target.value)} /></Field></>}<Field label="Question type"><Select value={settings.questionType} onValueChange={(v) => update("questionType", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="standalone">Standalone</SelectItem><SelectItem value="situation">Situation</SelectItem></SelectContent></Select></Field><Field label="Difficulty"><Select value={settings.difficulty} onValueChange={(v) => update("difficulty", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["mixed", "easy", "medium", "hard"].map((v) => <SelectItem key={v} value={v}>{v[0].toUpperCase() + v.slice(1)}</SelectItem>)}</SelectContent></Select></Field>{!exam && <Field label="Practice collection"><Select value={settings.collection} onValueChange={(v) => update("collection", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All questions</SelectItem><SelectItem value="wrong">Wrong answers only</SelectItem><SelectItem value="past-board">Past Board questions</SelectItem><SelectItem value="ai">AI Generated</SelectItem><SelectItem value="manual">Manual questions</SelectItem></SelectContent></Select></Field>}<Field label="Question order"><Select value={settings.questionOrder} onValueChange={(v) => update("questionOrder", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="original">Original</SelectItem><SelectItem value="shuffle">Shuffle</SelectItem></SelectContent></Select></Field>{!exam && <><Field label="Situation order"><Select value={settings.situationOrder} onValueChange={(v) => update("situationOrder", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="original">Original</SelectItem><SelectItem value="shuffle">Shuffle</SelectItem></SelectContent></Select></Field><Field label="Questions inside situation"><Select value={settings.withinSituation} onValueChange={(v) => update("withinSituation", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="original">Keep order</SelectItem><SelectItem value="shuffle">Shuffle</SelectItem></SelectContent></Select></Field></>}<Field label="Question count"><Select value={String(settings.count)} onValueChange={(v) => update("count", v === "custom" ? "custom" : Number(v))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(exam ? mockCounts : counts).map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}<SelectItem value="custom">Custom</SelectItem></SelectContent></Select>{settings.count === "custom" && <Input className="mt-2" type="number" min="1" value={settings.customCount} onChange={(e) => update("customCount", e.target.value)} />}</Field><Field label="Time limit"><Select value={settings.timeLimit} onValueChange={(v) => update("timeLimit", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{limits.map((limit) => <SelectItem key={limit.value} value={limit.value}>{limit.label}</SelectItem>)}</SelectContent></Select>{settings.timeLimit === "custom" && <Input className="mt-2" type="number" min="1" placeholder="Minutes" value={settings.customLimit} onChange={(e) => update("customLimit", e.target.value)} />}</Field><div className="md:col-span-2"><Button onClick={start}>Start {exam ? "exam" : "practice"}</Button></div></div></div>;
  let position = 0;
  return <div className="space-y-4"><div className="flex justify-between text-sm"><span>{selected.length} questions · {settings.subject === "all" ? "All subjects" : settings.subject}</span><span>{limitSeconds ? `${minuteText(Math.max(limitSeconds - elapsed, 0))} remaining` : `Time: ${minuteText(elapsed)}`}</span></div>{active.map((unit, unitIndex) => { const entries = unit.questions.map((question) => ({ question, index: position++ })); return unit.kind === "situation" ? <SituationViewer key={unit.situation.id} situation={unit.situation}><div className="space-y-2">{entries.map((entry) => <Question {...entry} key={`${entry.question.id}-${entry.index}`} />)}</div></SituationViewer> : <Question {...entries[0]} key={`${unitIndex}-${entries[0].question.id}`} />; })}<div className="flex gap-2"><Button onClick={finish} disabled={submitted}>Submit</Button><Button variant="outline" onClick={() => setActive(null)}>New session</Button></div>{submitted && <div className="glass-card p-4"><h2 className="font-semibold">Results saved to Exam History</h2><p className="text-sm text-muted-foreground">Correct: {selected.filter((q, i) => sameAnswer(q, answers[i])).length} · Wrong: {selected.filter((q, i) => answers[i] && !sameAnswer(q, answers[i])).length} · Skipped: {selected.filter((_, i) => !answers[i]).length}</p></div>}</div>;
}
function Field({ label, children }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>; }
