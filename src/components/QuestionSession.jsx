import React, { useEffect, useMemo, useState } from "react";
import { firebaseApi } from "@/api/firebaseClient";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import RemoteFigure from "@/components/RemoteFigure";
import SituationViewer from "@/components/SituationViewer";
import { LatexText } from "@/components/LatexFormula";
import { buildQuestionSession } from "@/lib/questionSessionOrder";

const sources = [
  { value: "manual", label: "Manual Only" },
  { value: "ai", label: "AI Only" },
  { value: "imported", label: "Imported Only" },
  { value: "mixed", label: "Mixed" },
];
const subjects = ["all", "PSAD", "MSTE", "HGE"];

export default function QuestionSession({ exam = false }) {
  const [user, setUser] = useState(null);
  const [source, setSource] = useState("mixed");
  const [subject, setSubject] = useState("all");
  const [count, setCount] = useState(exam ? 50 : 10);
  const [active, setActive] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [questionOrder, setQuestionOrder] = useState("original");
  const [withinSituation, setWithinSituation] = useState("original");
  const { toast } = useToast();
  useEffect(() => {
    firebaseApi.auth.me().then(setUser);
  }, []);
  const selected = useMemo(
    () => active?.flatMap((unit) => unit.questions) || [],
    [active],
  );
  const correct = (question, answer) =>
    String(answer || "")
      .trim()
      .toLowerCase() ===
      String(question.correctAnswer || "")
        .trim()
        .toLowerCase() ||
    question.choices?.[
      Number(String(question.correctAnswer).charCodeAt(0)) - 65
    ] === answer;
  const start = async () => {
    if (!user) return;
    const [all, situations] = await Promise.all([
      firebaseApi.entities.Question.filter({ user_id: user.id }),
      firebaseApi.entities.Situation.filter({ user_id: user.id }),
    ]);
    const eligible = all.filter(
      (question) =>
        (source === "mixed" || question.sourceType === source) &&
        (subject === "all" || question.subject === subject),
    );
    if (!eligible.length)
      return toast({
        title: "No questions match these selections",
        variant: "destructive",
      });
    setActive(
      buildQuestionSession(eligible, situations, {
        count,
        shuffleQuestions: questionOrder === "shuffle",
        shuffleWithinSituation: withinSituation === "shuffle",
      }),
    );
    setAnswers({});
    setSubmitted(false);
  };
  const finish = async () => {
    const score = selected.filter((question, index) =>
      correct(question, answers[index]),
    ).length;
    const record = {
      user_id: user.id,
      source,
      subject,
      questionCount: selected.length,
      correct: score,
      score: selected.length ? Math.round((score / selected.length) * 100) : 0,
      completedAt: new Date().toISOString(),
    };
    await (
      exam
        ? firebaseApi.entities.ExamResult
        : firebaseApi.entities.PracticeHistory
    ).create(record);
    await firebaseApi.entities.UserQuestionHistory.bulkCreate(
      selected.map((question, index) => ({
        user_id: user.id,
        questionId: question.id,
        selectedAnswer: answers[index] || "",
        isCorrect: correct(question, answers[index]),
        mode: exam ? "mock_exam" : "practice",
      })),
    );
    setSubmitted(true);
  };
  const Question = ({ question, index }) => (
    <article className="rounded-lg border bg-background/40 p-3">
      {question.imageUrl && (
        <RemoteFigure
          url={question.imageUrl}
          label={question.figureLabel || "Question figure"}
        />
      )}
      <p className="mt-2 font-medium">
        {index + 1}. <LatexText value={question.question} />
      </p>
      <RadioGroup
        value={answers[index] || ""}
        onValueChange={(value) =>
          setAnswers((previous) => ({ ...previous, [index]: value }))
        }
        disabled={submitted}
        className="mt-2 grid gap-1.5"
      >
        {(question.choices || []).map((choice, choiceIndex) => (
          <div className="flex items-center gap-2" key={choiceIndex}>
            <RadioGroupItem
              value={choice}
              id={`${question.id}-${choiceIndex}`}
            />
            <Label htmlFor={`${question.id}-${choiceIndex}`}>
              {String.fromCharCode(65 + choiceIndex)}.{" "}
              <LatexText value={choice} />
            </Label>
          </div>
        ))}
      </RadioGroup>
      {submitted && (
        <div className="mt-2 text-sm">
          <p className="font-medium">
            Answer: <LatexText value={question.correctAnswer} />
          </p>
          {question.explanation && (
            <p className="text-muted-foreground">
              <LatexText value={question.explanation} />
            </p>
          )}
        </div>
      )}
    </article>
  );
  if (!active)
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">
            {exam ? "Mock Board Exam" : "Practice Mode"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Build a mixed session of standalone questions and intact board-exam
            situations.
          </p>
        </div>
        <div className="glass-card space-y-4 p-4">
          <div>
            <Label>{exam ? "Exam mode" : "Subject"}</Label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((value) => (
                  <SelectItem key={value} value={value}>
                    {exam && value === "all"
                      ? "Full Board Exam"
                      : value === "all"
                        ? "All Subjects"
                        : `${value}${exam ? " Only" : ""}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Question source</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sources.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Question count</Label>
            <Select
              value={String(count)}
              onValueChange={(value) => setCount(Number(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[5, 10, 25, 50, 100].map((number) => (
                  <SelectItem key={number} value={String(number)}>
                    {number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Question Order</Label>
            <RadioGroup
              value={questionOrder}
              onValueChange={setQuestionOrder}
              className="mt-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="original" id="order-original" />
                <Label htmlFor="order-original">Original Order</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="shuffle" id="order-shuffle" />
                <Label htmlFor="order-shuffle">Shuffle Questions</Label>
              </div>
            </RadioGroup>
          </div>
          <div>
            <Label>Within Situation</Label>
            <RadioGroup
              value={withinSituation}
              onValueChange={setWithinSituation}
              className="mt-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="original" id="within-original" />
                <Label htmlFor="within-original">Keep Original Order</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="shuffle" id="within-shuffle" />
                <Label htmlFor="within-shuffle">Shuffle Questions</Label>
              </div>
            </RadioGroup>
          </div>
          <Button onClick={start}>Start {exam ? "exam" : "practice"}</Button>
        </div>
      </div>
    );
  let questionIndex = 0;
  return (
    <div className="space-y-4">
      <div className="flex justify-between text-sm">
        <span>
          {selected.length} questions ·{" "}
          {subject === "all" ? "All subjects" : subject}
        </span>
        {submitted && (
          <span className="font-semibold">
            Score:{" "}
            {selected.length
              ? Math.round(
                  (selected.filter((question, index) =>
                    correct(question, answers[index]),
                  ).length /
                    selected.length) *
                    100,
                )
              : 0}
            %
          </span>
        )}
      </div>
      {active.map((unit, unitIndex) => {
        const entries = unit.questions.map((question) => ({
          question,
          index: questionIndex++,
        }));
        return unit.kind === "situation" ? (
          <SituationViewer key={unit.situation.id} situation={unit.situation}>
            <div className="space-y-2">
              {entries.map((entry) => (
                <Question {...entry} key={entry.question.id} />
              ))}
            </div>
          </SituationViewer>
        ) : (
          <Question
            {...entries[0]}
            key={`${unitIndex}-${entries[0].question.id}`}
          />
        );
      })}
      <div className="flex gap-2">
        <Button onClick={finish} disabled={submitted}>
          Submit
        </Button>
        <Button variant="outline" onClick={() => setActive(null)}>
          New session
        </Button>
      </div>
    </div>
  );
}
