"use client";

import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import { useAuth } from "../context/AuthContext";
import {
  AcademicCapIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowRightIcon,
  SparklesIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";

import { API_URL as API } from "../config";

interface Paper {
  id: number;
  original_filename: string;
  status: string;
  metadata: { title: string | null };
}

interface QuizQuestion {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

export default function QuizPage() {
  const { user } = useAuth();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [selectedPaperId, setSelectedPaperId] = useState<string>("");
  const [numQuestions, setNumQuestions] = useState<number>(5);
  const [loadingPapers, setLoadingPapers] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  
  // Quiz active state
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState<number | null>(null);
  const [answerSubmitted, setAnswerSubmitted] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [finished, setFinished] = useState<boolean>(false);
  const [answersLog, setAnswersLog] = useState<Array<{ questionIdx: number; selectedOption: number; isCorrect: boolean }>>([]);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    fetch(`${API}/papers`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => (res.ok ? res.json() : []))
      .then(data => {
        const completed = (Array.isArray(data) ? data : []).filter(
          p => p.status === "completed"
        );
        setPapers(completed);
        if (completed.length > 0) {
          setSelectedPaperId(String(completed[0].id));
        }
        setLoadingPapers(false);
      })
      .catch(err => {
        console.error("Failed to load papers:", err);
        setLoadingPapers(false);
      });
  }, []);

  async function handleGenerateQuiz() {
    if (!selectedPaperId) return;
    setGenerating(true);
    setQuestions([]);
    setCurrentIdx(0);
    setSelectedOptionIdx(null);
    setAnswerSubmitted(false);
    setScore(0);
    setFinished(false);
    setAnswersLog([]);

    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch(`${API}/quiz/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          paper_id: Number(selectedPaperId),
          num_questions: numQuestions,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to generate quiz");
      }

      const data = await res.json();
      setQuestions(data);
    } catch (err) {
      console.error(err);
      alert("Failed to generate quiz. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  function handleOptionSelect(idx: number) {
    if (answerSubmitted) return;
    setSelectedOptionIdx(idx);
  }

  function handleSubmitAnswer() {
    if (selectedOptionIdx === null || answerSubmitted) return;

    const currentQuestion = questions[currentIdx];
    const isCorrect = selectedOptionIdx === currentQuestion.correct_index;

    if (isCorrect) {
      setScore(prev => prev + 1);
    }

    setAnswersLog(prev => [
      ...prev,
      {
        questionIdx: currentIdx,
        selectedOption: selectedOptionIdx,
        isCorrect,
      },
    ]);

    setAnswerSubmitted(true);
  }

  function handleNextQuestion() {
    setSelectedOptionIdx(null);
    setAnswerSubmitted(false);

    if (currentIdx + 1 < questions.length) {
      setCurrentIdx(prev => prev + 1);
    } else {
      setFinished(true);
    }
  }

  function handleRestart() {
    setQuestions([]);
    setCurrentIdx(0);
    setSelectedOptionIdx(null);
    setAnswerSubmitted(false);
    setScore(0);
    setFinished(false);
    setAnswersLog([]);
  }

  // Render Selection Screen
  if (questions.length === 0 && !generating) {
    return (
      <AppShell>
        <div className="max-w-xl mx-auto space-y-8 py-6">
          <div className="p-8 rounded-3xl bg-[#130F26] border border-[#271F4D] shadow-2xl text-center">
            <div className="w-16 h-16 mx-auto mb-6 bg-[#251B4F] text-[#A855F7] rounded-2xl flex items-center justify-center border border-[#3D2C81] shadow-lg">
              <AcademicCapIcon className="w-8 h-8" />
            </div>
            
            <h1 className="text-3xl font-black text-white mb-2 tracking-tight">
              Quiz Generator
            </h1>
            <p className="text-xs text-slate-400 mb-8 max-w-md mx-auto">
              Test your knowledge on any research paper in your library.
            </p>

            {loadingPapers ? (
              <div className="flex items-center justify-center gap-3 text-slate-400 py-6">
                <ArrowPathIcon className="w-5 h-5 animate-spin text-[#A855F7]" />
                <span>Loading your library...</span>
              </div>
            ) : papers.length === 0 ? (
              <div className="py-6 border border-dashed border-[#271F4D] rounded-2xl bg-black/20">
                <DocumentTextIcon className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                <p className="text-sm font-medium text-slate-400">No papers processed yet</p>
                <p className="text-xs text-slate-600 mt-1">Please upload a paper and wait for it to process.</p>
              </div>
            ) : (
              <div className="space-y-6 text-left">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Select Research Paper
                  </label>
                  <select
                    value={selectedPaperId}
                    onChange={e => setSelectedPaperId(e.target.value)}
                    className="w-full bg-[#1A1438] border border-[#2E245A] rounded-xl px-4 py-3 text-sm font-medium text-slate-200 outline-none hover:border-[#8B5CF6]/50 transition-colors cursor-pointer"
                  >
                    {papers.map(p => (
                      <option key={p.id} value={p.id} className="bg-[#130F26]">
                        {p.metadata.title || p.original_filename}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Number of Questions
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[3, 5, 10].map(num => (
                      <button
                        key={num}
                        onClick={() => setNumQuestions(num)}
                        className={`py-2.5 rounded-xl border text-sm font-bold transition-all duration-200 cursor-pointer ${
                          numQuestions === num
                            ? "bg-gradient-to-r from-[#8B5CF6] to-[#D946EF] border-[#A855F7] text-white shadow-lg"
                            : "bg-[#1A1438] border-[#2E245A] text-slate-400 hover:text-white"
                        }`}
                      >
                        {num} Questions
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleGenerateQuiz}
                  className="w-full mt-6 py-4 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#D946EF] hover:from-[#7C3AED] hover:to-[#C026D3] text-white font-bold transition-all shadow-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  <SparklesIcon className="w-5 h-5" />
                  Generate Quiz
                </button>
              </div>
            )}
          </div>
        </div>
      </AppShell>
    );
  }

  // Render Loading Screen
  if (generating) {
    return (
      <AppShell>
        <div className="max-w-md mx-auto py-12 text-center">
          <div className="p-8 rounded-3xl bg-[#130F26] border border-[#271F4D] shadow-2xl space-y-6">
            <div className="w-16 h-16 mx-auto rounded-full border-4 border-[#8B5CF6]/20 border-t-[#8B5CF6] animate-spin flex items-center justify-center">
              <SparklesIcon className="w-8 h-8 text-[#A855F7] animate-pulse" />
            </div>
            <h3 className="text-xl font-bold text-white">Creating Your Quiz</h3>
            <p className="text-xs text-slate-400">Formulating MCQs and explanations from text...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  // Render Quiz Screen
  const currentQuestion = questions[currentIdx];
  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="p-8 rounded-3xl bg-[#130F26] border border-[#271F4D] shadow-2xl space-y-6">
          <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-widest">
            <span>Question {currentIdx + 1} of {questions.length}</span>
            <span>Score: {score}</span>
          </div>

          <h2 className="text-lg font-bold text-slate-100 leading-snug">
            {currentQuestion.question}
          </h2>

          <div className="space-y-3">
            {currentQuestion.options.map((opt, oIdx) => {
              const isSelected = selectedOptionIdx === oIdx;
              const isCorrect = currentQuestion.correct_index === oIdx;

              let style = "bg-[#1A1438] border-[#2E245A] text-slate-300 hover:border-[#8B5CF6]/40";
              if (answerSubmitted) {
                if (isCorrect) style = "bg-emerald-500/15 border-emerald-500/40 text-emerald-300";
                else if (isSelected) style = "bg-rose-500/15 border-rose-500/40 text-rose-300";
                else style = "bg-[#1A1438] border-[#2E245A] text-slate-600 opacity-50";
              } else if (isSelected) {
                style = "bg-[#8B5CF6]/20 border-[#8B5CF6] text-white ring-2 ring-[#8B5CF6]/30";
              }

              return (
                <button
                  key={oIdx}
                  onClick={() => handleOptionSelect(oIdx)}
                  disabled={answerSubmitted}
                  className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border text-left text-sm font-semibold transition-all cursor-pointer ${style}`}
                >
                  <span>{opt}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-4 flex justify-end">
            {!answerSubmitted ? (
              <button
                onClick={handleSubmitAnswer}
                disabled={selectedOptionIdx === null}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#D946EF] text-white font-bold disabled:opacity-40 transition-all cursor-pointer"
              >
                Submit Answer
              </button>
            ) : (
              <button
                onClick={handleNextQuestion}
                className="px-6 py-3 rounded-xl bg-white/15 text-white font-bold hover:bg-white/20 transition-all cursor-pointer flex items-center gap-2"
              >
                Next Question <ArrowRightIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
