import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { firebaseApi } from "@/api/firebaseClient";
import { Button } from "@/components/ui/button";

export default function MistakeNotebook() {
  const [notes, setNotes] = useState([]); const navigate = useNavigate();
  useEffect(() => { firebaseApi.auth.me().then(async (user) => setNotes(await firebaseApi.entities.MistakeNotebook.filter({ user_id: user.id }))); }, []);
  return <div className="space-y-4"><div><h1 className="text-2xl font-bold">Mistake Notebook</h1><p className="text-sm text-muted-foreground">Questions you missed, synced across devices.</p></div><Button disabled={!notes.length} onClick={() => navigate("/practice", { state: { questions: notes.map((note) => note.question) } })}>Practice Wrong Answers Only</Button>{!notes.length ? <div className="glass-card p-8 text-center text-muted-foreground">Wrong answers will appear here after you submit an exam.</div> : notes.map((note) => <article className="glass-card p-4" key={note.id}><p className="font-medium">{note.question?.question || "Question unavailable"}</p><p className="mt-2 text-sm text-destructive">Your answer: {note.userWrongAnswer}</p><p className="text-sm text-emerald-600">Correct: {note.correctAnswer}</p>{note.explanation && <p className="mt-2 text-sm text-muted-foreground">{note.explanation}</p>}<p className="mt-2 text-xs text-muted-foreground">Missed {note.timesMissed || 1} time(s) · {note.topic || "No topic"}{note.questionSource ? ` · Source: ${note.questionSource}` : ""}</p></article>)}</div>;
}
