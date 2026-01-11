import { useState, useEffect, useRef } from "react";
import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/quiz";
import { prisma } from "../utils/db.server";
import { requireUserId } from "../utils/session.server";

export function meta({ data }: Route.MetaArgs) {
    return [{ title: `Kiểm tra: ${data?.topic?.viTitle || data?.topic?.title || "Quiz"} - LinguaFast` }];
}

export async function loader({ params, request }: Route.LoaderArgs) {
    await requireUserId(request);
    const topicId = params.topicId;

    const topic = await prisma.topic.findUnique({
        where: { slug: topicId! },
        include: {
            words: {
                where: { topicId: { not: undefined } }
            }
        }
    });

    if (!topic) throw new Response("Not Found", { status: 404 });

    return { topic };
}

type QuestionType = "meaning" | "word" | "typing" | "sentence";

interface Question {
    type: QuestionType;
    word: {
        id: string;
        term: string;
        translation: string | null;
        definition: string;
        viDefinition: string | null;
        example: string;
        phonetic: string | null;
    };
    options?: string[];
    correctAnswer: string;
}

function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function generateQuestions(words: any[], count: number): Question[] {
    if (words.length < 4) return [];

    const shuffledWords = shuffleArray(words);
    const selectedWords = shuffledWords.slice(0, Math.min(count, words.length));
    const questions: Question[] = [];

    const questionTypes: QuestionType[] = ["meaning", "word", "typing", "sentence"];

    selectedWords.forEach((word, index) => {
        const type = questionTypes[index % questionTypes.length];
        const otherWords = words.filter(w => w.id !== word.id);
        const wrongOptions = shuffleArray(otherWords).slice(0, 3);

        if (type === "meaning") {
            // Given English word, choose Vietnamese meaning
            const options = shuffleArray([
                word.translation || word.viDefinition || "",
                ...wrongOptions.map(w => w.translation || w.viDefinition || "")
            ].filter(Boolean));

            questions.push({
                type,
                word,
                options,
                correctAnswer: word.translation || word.viDefinition || ""
            });
        } else if (type === "word") {
            // Given Vietnamese meaning, choose English word
            const options = shuffleArray([
                word.term,
                ...wrongOptions.map(w => w.term)
            ]);

            questions.push({
                type,
                word,
                options,
                correctAnswer: word.term
            });
        } else if (type === "typing") {
            // Type the English word
            questions.push({
                type,
                word,
                correctAnswer: word.term.toLowerCase()
            });
        } else if (type === "sentence") {
            // Fill in the blank in the example sentence
            const blankSentence = word.example.replace(
                new RegExp(word.term, "gi"),
                "_____"
            );
            questions.push({
                type,
                word: { ...word, example: blankSentence },
                correctAnswer: word.term.toLowerCase()
            });
        }
    });

    return shuffleArray(questions);
}

export default function Quiz() {
    const { topic } = useLoaderData<typeof loader>();
    const words = topic.words;

    const [quizStarted, setQuizStarted] = useState(false);
    const [questionCount, setQuestionCount] = useState(10);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [typedAnswer, setTypedAnswer] = useState("");
    const [showResult, setShowResult] = useState(false);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [score, setScore] = useState(0);
    const [quizEnded, setQuizEnded] = useState(false);
    const [answers, setAnswers] = useState<{ question: Question; userAnswer: string; correct: boolean }[]>([]);

    const inputRef = useRef<HTMLInputElement>(null);

    const currentQuestion = questions[currentIndex];

    // Text-to-speech
    const speak = (text: string) => {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    };

    const startQuiz = () => {
        const generatedQuestions = generateQuestions(words, questionCount);
        if (generatedQuestions.length === 0) return;
        setQuestions(generatedQuestions);
        setQuizStarted(true);
        setCurrentIndex(0);
        setScore(0);
        setAnswers([]);
        setQuizEnded(false);
    };

    const checkAnswer = () => {
        if (!currentQuestion) return;

        let userAnswer = "";
        let correct = false;

        if (currentQuestion.type === "typing" || currentQuestion.type === "sentence") {
            userAnswer = typedAnswer.trim().toLowerCase();
            correct = userAnswer === currentQuestion.correctAnswer.toLowerCase();
        } else {
            userAnswer = selectedAnswer || "";
            correct = userAnswer === currentQuestion.correctAnswer;
        }

        setIsCorrect(correct);
        setShowResult(true);
        if (correct) setScore(prev => prev + 1);

        setAnswers(prev => [...prev, { question: currentQuestion, userAnswer, correct }]);
    };

    const nextQuestion = () => {
        if (currentIndex + 1 >= questions.length) {
            setQuizEnded(true);
        } else {
            setCurrentIndex(prev => prev + 1);
            setSelectedAnswer(null);
            setTypedAnswer("");
            setShowResult(false);
            setIsCorrect(null);
        }
    };

    useEffect(() => {
        if (quizStarted && currentQuestion && (currentQuestion.type === "typing" || currentQuestion.type === "sentence")) {
            inputRef.current?.focus();
        }
    }, [currentIndex, quizStarted, currentQuestion]);

    // Not enough words
    if (words.length < 4) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="text-6xl mb-4">📝</div>
                    <h1 className="text-2xl font-black text-white mb-2">Chưa đủ từ vựng</h1>
                    <p className="text-white/60 mb-6">Cần ít nhất 4 từ để tạo bài kiểm tra</p>
                    <Link
                        to={`/learn/${topic.slug}`}
                        className="px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark transition-all"
                    >
                        Thêm từ vựng
                    </Link>
                </div>
            </div>
        );
    }

    // Quiz ended - show final results
    if (quizEnded) {
        const percentage = Math.round((score / questions.length) * 100);
        let emoji = "🎉";
        let message = "Xuất sắc!";
        if (percentage < 50) {
            emoji = "📚";
            message = "Cần ôn tập thêm!";
        } else if (percentage < 80) {
            emoji = "👍";
            message = "Khá tốt!";
        }

        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 p-4">
                <div className="container max-w-2xl mx-auto py-12">
                    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                        <div className={`p-8 text-center ${percentage >= 80 ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : percentage >= 50 ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-rose-500 to-pink-500'}`}>
                            <div className="text-6xl mb-4">{emoji}</div>
                            <h1 className="text-3xl font-black text-white mb-2">{message}</h1>
                            <div className="text-7xl font-black text-white/90">{percentage}%</div>
                            <p className="text-white/80 font-bold mt-2">
                                {score}/{questions.length} câu đúng
                            </p>
                        </div>

                        <div className="p-6">
                            <h2 className="text-lg font-black text-gray-900 mb-4">Chi tiết kết quả</h2>
                            <div className="space-y-3 max-h-80 overflow-y-auto">
                                {answers.map((a, i) => (
                                    <div
                                        key={i}
                                        className={`p-4 rounded-xl border-2 ${a.correct ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-lg ${a.correct ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                {a.correct ? '✓' : '✗'}
                                            </span>
                                            <span className="font-black text-gray-900">{a.question.word.term}</span>
                                            <span className="text-gray-400 text-sm">{a.question.word.phonetic}</span>
                                        </div>
                                        <p className="text-sm text-gray-600">
                                            {a.question.word.translation || a.question.word.viDefinition}
                                        </p>
                                        {!a.correct && (
                                            <p className="text-xs text-rose-600 mt-1">
                                                Bạn trả lời: {a.userAnswer || "(trống)"}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-6 pt-0 flex gap-3">
                            <button
                                onClick={() => {
                                    setQuizStarted(false);
                                    setQuizEnded(false);
                                }}
                                className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all"
                            >
                                Làm lại
                            </button>
                            <Link
                                to={`/learn/${topic.slug}`}
                                className="flex-1 px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark transition-all text-center"
                            >
                                Quay lại học
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Quiz not started - show setup screen
    if (!quizStarted) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full">
                    <div className="text-center mb-8">
                        <div className="w-20 h-20 bg-gradient-to-br from-primary to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-4xl shadow-lg">
                            📝
                        </div>
                        <h1 className="text-2xl font-black text-gray-900 mb-2">Kiểm tra từ vựng</h1>
                        <p className="text-gray-500 font-medium">{topic.viTitle || topic.title}</p>
                        <p className="text-sm text-gray-400 mt-1">{words.length} từ vựng</p>
                    </div>

                    <div className="mb-8">
                        <label className="block text-sm font-black text-gray-600 uppercase tracking-wider mb-3">
                            Số câu hỏi
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                            {[5, 10, 15, 20].map(num => (
                                <button
                                    key={num}
                                    onClick={() => setQuestionCount(num)}
                                    disabled={num > words.length}
                                    className={`py-3 rounded-xl font-bold transition-all ${questionCount === num
                                            ? "bg-primary text-white shadow-lg"
                                            : num > words.length
                                                ? "bg-gray-100 text-gray-300 cursor-not-allowed"
                                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                        }`}
                                >
                                    {num}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <button
                            onClick={startQuiz}
                            className="w-full py-4 bg-gradient-to-r from-primary to-indigo-600 text-white font-black rounded-xl hover:shadow-lg transition-all text-lg"
                        >
                            Bắt đầu kiểm tra
                        </button>
                        <Link
                            to={`/learn/${topic.slug}`}
                            className="block w-full py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all text-center"
                        >
                            ← Quay lại
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // Quiz in progress
    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 p-4">
            <div className="container max-w-2xl mx-auto py-8">
                {/* Progress bar */}
                <div className="mb-8">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-white/60 font-bold text-sm">
                            Câu {currentIndex + 1}/{questions.length}
                        </span>
                        <span className="text-white/60 font-bold text-sm">
                            Điểm: {score}
                        </span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-primary to-indigo-500 transition-all duration-300"
                            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Question card */}
                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                    {/* Question header */}
                    <div className="p-6 bg-gradient-to-r from-primary/10 to-indigo-100">
                        {currentQuestion.type === "meaning" && (
                            <>
                                <p className="text-sm font-black text-primary uppercase tracking-wider mb-2">
                                    Chọn nghĩa đúng
                                </p>
                                <div className="flex items-center gap-3">
                                    <h2 className="text-3xl font-black text-gray-900">{currentQuestion.word.term}</h2>
                                    <button
                                        onClick={() => speak(currentQuestion.word.term)}
                                        className="p-2 bg-primary/10 rounded-lg text-primary hover:bg-primary hover:text-white transition-all"
                                    >
                                        🔊
                                    </button>
                                </div>
                                <p className="text-gray-400 font-medium mt-1">{currentQuestion.word.phonetic}</p>
                            </>
                        )}

                        {currentQuestion.type === "word" && (
                            <>
                                <p className="text-sm font-black text-primary uppercase tracking-wider mb-2">
                                    Chọn từ tiếng Anh đúng
                                </p>
                                <h2 className="text-2xl font-black text-gray-900">
                                    {currentQuestion.word.translation || currentQuestion.word.viDefinition}
                                </h2>
                            </>
                        )}

                        {currentQuestion.type === "typing" && (
                            <>
                                <p className="text-sm font-black text-primary uppercase tracking-wider mb-2">
                                    Gõ từ tiếng Anh
                                </p>
                                <h2 className="text-2xl font-black text-gray-900 mb-2">
                                    {currentQuestion.word.translation || currentQuestion.word.viDefinition}
                                </h2>
                                <button
                                    onClick={() => speak(currentQuestion.correctAnswer)}
                                    className="px-4 py-2 bg-primary/10 rounded-lg text-primary font-bold hover:bg-primary hover:text-white transition-all flex items-center gap-2"
                                >
                                    🔊 Nghe phát âm
                                </button>
                            </>
                        )}

                        {currentQuestion.type === "sentence" && (
                            <>
                                <p className="text-sm font-black text-primary uppercase tracking-wider mb-2">
                                    Điền từ vào chỗ trống
                                </p>
                                <h2 className="text-xl font-bold text-gray-900">
                                    "{currentQuestion.word.example}"
                                </h2>
                                <p className="text-gray-500 text-sm mt-2 italic">
                                    Gợi ý: {currentQuestion.word.translation || currentQuestion.word.viDefinition}
                                </p>
                            </>
                        )}
                    </div>

                    {/* Answer section */}
                    <div className="p-6">
                        {(currentQuestion.type === "meaning" || currentQuestion.type === "word") && currentQuestion.options && (
                            <div className="space-y-3">
                                {currentQuestion.options.map((option, i) => {
                                    let buttonClass = "w-full p-4 rounded-xl border-2 text-left font-medium transition-all ";

                                    if (showResult) {
                                        if (option === currentQuestion.correctAnswer) {
                                            buttonClass += "border-emerald-500 bg-emerald-50 text-emerald-700";
                                        } else if (option === selectedAnswer && !isCorrect) {
                                            buttonClass += "border-rose-500 bg-rose-50 text-rose-700";
                                        } else {
                                            buttonClass += "border-gray-200 bg-gray-50 text-gray-400";
                                        }
                                    } else {
                                        buttonClass += selectedAnswer === option
                                            ? "border-primary bg-primary/10 text-primary"
                                            : "border-gray-200 hover:border-primary hover:bg-primary/5";
                                    }

                                    return (
                                        <button
                                            key={i}
                                            onClick={() => !showResult && setSelectedAnswer(option)}
                                            disabled={showResult}
                                            className={buttonClass}
                                        >
                                            <span className="mr-3 inline-flex w-8 h-8 items-center justify-center rounded-full bg-gray-200 text-gray-600 font-bold text-sm">
                                                {String.fromCharCode(65 + i)}
                                            </span>
                                            {option}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {(currentQuestion.type === "typing" || currentQuestion.type === "sentence") && (
                            <div>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={typedAnswer}
                                    onChange={(e) => !showResult && setTypedAnswer(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !showResult && typedAnswer.trim()) {
                                            checkAnswer();
                                        }
                                    }}
                                    disabled={showResult}
                                    placeholder="Nhập câu trả lời..."
                                    className={`w-full p-4 text-xl font-bold rounded-xl border-2 outline-none transition-all ${showResult
                                            ? isCorrect
                                                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                                : "border-rose-500 bg-rose-50 text-rose-700"
                                            : "border-gray-200 focus:border-primary"
                                        }`}
                                />
                                {showResult && !isCorrect && (
                                    <p className="mt-3 text-emerald-600 font-bold">
                                        Đáp án đúng: <span className="text-xl">{currentQuestion.correctAnswer}</span>
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Result feedback */}
                        {showResult && (
                            <div className={`mt-6 p-4 rounded-xl ${isCorrect ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                                <p className={`font-black text-lg ${isCorrect ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {isCorrect ? '🎉 Chính xác!' : '😔 Chưa đúng rồi!'}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Action buttons */}
                    <div className="p-6 pt-0">
                        {!showResult ? (
                            <button
                                onClick={checkAnswer}
                                disabled={
                                    (currentQuestion.type === "meaning" || currentQuestion.type === "word")
                                        ? !selectedAnswer
                                        : !typedAnswer.trim()
                                }
                                className="w-full py-4 bg-gradient-to-r from-primary to-indigo-600 text-white font-black rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Kiểm tra
                            </button>
                        ) : (
                            <button
                                onClick={nextQuestion}
                                className="w-full py-4 bg-gradient-to-r from-primary to-indigo-600 text-white font-black rounded-xl hover:shadow-lg transition-all"
                            >
                                {currentIndex + 1 >= questions.length ? "Xem kết quả" : "Câu tiếp theo →"}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
