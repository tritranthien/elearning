import { useState, useMemo } from "react";
import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/learn";
import { prisma } from "../utils/db.server";
import { requireUserId } from "../utils/session.server";
import { generateWordsForTopic } from "../utils/ai.server";
import { useFetcher } from "react-router";
import { toast } from "sonner";
import { useEffect, useRef } from "react";

export function meta({ params }: Route.MetaArgs) {
    return [{ title: `Đang học ${params.topicId} - LinguaFast` }];
}

export async function loader({ params, request }: Route.LoaderArgs) {
    const userId = await requireUserId(request);

    const topic = await prisma.topic.findUnique({
        where: { slug: params.topicId },
        include: {
            words: {
                include: {
                    progress: {
                        where: { userId }
                    }
                }
            }
        }
    });

    if (!topic) {
        throw new Response("Not Found", { status: 404 });
    }

    // Fetch full user for UI
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, firstName: true, lastName: true, email: true }
    });

    // Auto-select 10 words if none are selected
    try {
        const selectedCount = topic.words.filter(w => w.progress[0]?.isSelected).length;
        if (selectedCount === 0) {
            console.log("Auto-selecting words for user", userId);
            const wordsToSelect = topic.words
                .filter(w => !w.progress[0]?.isIgnored)
                .slice(0, 10);

            if (wordsToSelect.length > 0) {
                await Promise.all(wordsToSelect.map(w =>
                    prisma.userProgress.upsert({
                        where: { userId_wordId: { userId, wordId: w.id } },
                        create: { userId, wordId: w.id, isSelected: true },
                        update: { isSelected: true }
                    })
                ));

                // Re-fetch to get updated state
                const updatedTopic = await prisma.topic.findUnique({
                    where: { id: topic.id },
                    include: {
                        words: {
                            include: {
                                progress: { where: { userId } }
                            }
                        }
                    }
                });

                if (updatedTopic) {
                    return { topic: updatedTopic, allWords: updatedTopic.words, userId, user };
                }
            }
        }
    } catch (e) {
        console.error("Error in auto-select:", e);
        // Fallback to existing topic if auto-select fails
    }

    console.log(`Loaded topic: ${topic.title}, Words: ${topic.words.length}`);
    return { topic, allWords: topic.words, userId, user };
}

export async function action({ params, request }: Route.ActionArgs) {
    const userId = await requireUserId(request);
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "generate-words") {
        const topicId = params.topicId;
        const count = Math.min(Math.max(Number(formData.get("count")) || 5, 1), 15);

        const topic = await prisma.topic.findUnique({
            where: { slug: topicId! },
            include: { words: true }
        });

        if (!topic) throw new Response("Not Found", { status: 404 });

        if (!process.env.GEMINI_API_KEY_LEARN && !process.env.GEMINI_API_KEY) {
            return { error: "Vui lòng cấu hình GEMINI_API_KEY hoặc GEMINI_API_KEY_LEARN trong file .env." };
        }

        try {
            const existingTerms = topic.words.map(w => w.term);
            const newWords = await generateWordsForTopic(topic.viTitle || topic.title, existingTerms, count);

            // Filter out words that already exist globally (case-insensitive)
            const wordsToCreate = [];
            for (const w of newWords) {
                const existing = await prisma.word.findFirst({
                    where: { term: { equals: w.term, mode: "insensitive" } }
                });
                if (!existing) {
                    wordsToCreate.push({
                        term: w.term,
                        phonetic: w.phonetic,
                        type: w.type,
                        definition: w.definition,
                        translation: w.translation,
                        viDefinition: w.viDefinition,
                        example: w.example,
                        viExample: w.viExample
                    });
                }
            }

            if (wordsToCreate.length > 0) {
                await prisma.topic.update({
                    where: { id: topic.id },
                    data: {
                        words: { create: wordsToCreate }
                    }
                });
            }

            const skipped = newWords.length - wordsToCreate.length;
            return {
                success: true,
                intent: "generate-words",
                count: wordsToCreate.length,
                skipped
            };
        } catch (error: any) {
            return { error: error.message || "Lỗi khi tạo từ vựng.", intent: "generate-words" };
        }
    }

    if (intent === "toggle-ignore-word") {
        const wordId = formData.get("wordId") as string;
        const currentIgnored = formData.get("isIgnored") === "true";
        const newIgnoredState = !currentIgnored;

        await prisma.userProgress.upsert({
            where: {
                userId_wordId: { userId, wordId }
            },
            create: {
                userId,
                wordId,
                isIgnored: newIgnoredState,
                isSelected: false // Deselect if ignored
            },
            update: {
                isIgnored: newIgnoredState,
                isSelected: newIgnoredState ? false : undefined
            }
        });
        return { success: true, intent: "toggle-ignore-word", isIgnored: newIgnoredState };
    }

    if (intent === "toggle-select-word") {
        const wordId = formData.get("wordId") as string;
        const currentSelected = formData.get("isSelected") === "true";
        const newSelectedState = !currentSelected;

        await prisma.userProgress.upsert({
            where: {
                userId_wordId: { userId, wordId }
            },
            create: {
                userId,
                wordId,
                isSelected: newSelectedState
            },
            update: {
                isSelected: newSelectedState
            }
        });
        return { success: true, intent: "toggle-select-word", isSelected: newSelectedState };
    }

    if (intent === "toggle-select-all") {
        const topicId = params.topicId;
        const select = formData.get("select") === "true";

        const topic = await prisma.topic.findUnique({
            where: { slug: topicId! },
            include: { words: { include: { progress: { where: { userId } } } } }
        });

        if (topic) {
            const nonIgnoredWords = topic.words.filter(w => !w.progress[0]?.isIgnored);
            await Promise.all(nonIgnoredWords.map(w =>
                prisma.userProgress.upsert({
                    where: { userId_wordId: { userId, wordId: w.id } },
                    create: { userId, wordId: w.id, isSelected: select },
                    update: { isSelected: select }
                })
            ));
        }

        return { success: true, intent: "toggle-select-all" };
    }

    return { error: "Hành động không hợp lệ." };
}

type Phase = "preview" | "learning" | "matching" | "quiz" | "spelling" | "completed";

export default function Learn() {
    // ⚠️ DO NOT use useOutletContext() here because this route is NOT inside the main layout.
    // Use the 'user' object returned from the loader instead.
    const { topic, allWords, userId, user } = useLoaderData<typeof loader>();
    const fetcher = useFetcher();
    const isGenerating = fetcher.state !== "idle";
    const [aiWordCount, setAiWordCount] = useState(5);
    const [filter, setFilter] = useState<"active" | "ignored" | "all">("active");

    // Local state for optimistic updates
    const [localWordStatus, setLocalWordStatus] = useState<Record<string, { isSelected: boolean, isIgnored: boolean }>>(() => {
        const statuses: Record<string, { isSelected: boolean, isIgnored: boolean }> = {};
        allWords.forEach((w: any) => {
            statuses[w.id] = {
                isSelected: w.progress?.[0]?.isSelected || false,
                isIgnored: w.progress?.[0]?.isIgnored || false
            };
        });
        return statuses;
    });

    // Sync with loader data when idle
    useEffect(() => {
        if (fetcher.state === "idle") {
            setLocalWordStatus(prev => {
                const next = { ...prev };
                allWords.forEach((w: any) => {
                    next[w.id] = {
                        isSelected: w.progress?.[0]?.isSelected || false,
                        isIgnored: w.progress?.[0]?.isIgnored || false
                    };
                });
                return next;
            });
        }
    }, [allWords, fetcher.state]);

    // Toast notifications
    const lastToastId = useRef<string | null>(null);
    useEffect(() => {
        if (fetcher.state === "idle" && fetcher.data) {
            const data = fetcher.data as any;
            if (data.success) {
                if (data.intent === "generate-words") {
                    toast.success(`Đã thêm thành công ${data.count} từ mới từ AI!`);
                } else if (data.intent === "toggle-ignore-word") {
                    if (data.isIgnored) {
                        toast.error("Đã chuyển từ vào danh sách bỏ qua", {
                            icon: "🗑️",
                            duration: 2000
                        });
                    } else {
                        toast.success("Đã khôi phục từ vựng!", {
                            icon: "✨",
                            duration: 2000
                        });
                    }
                }
            } else if (data.error) {
                toast.error(data.error);
            }
            // Clear fetcher data theoretically or use a ref to prevent re-toast
        }
    }, [fetcher.state, fetcher.data]);

    // Derived words based on what's ignored
    const words = useMemo(() => {
        return allWords.filter(w => {
            const status = localWordStatus[w.id] || { isIgnored: false, isSelected: false };
            const isIgnored = status.isIgnored;
            if (filter === "active") return !isIgnored;
            if (filter === "ignored") return isIgnored;
            return true;
        });
    }, [allWords, filter, localWordStatus]);

    // Active words for learning (non-ignored AND selected)
    const activeWords = useMemo(() => {
        return allWords.filter(w => {
            const status = localWordStatus[w.id] || { isIgnored: false, isSelected: false };
            return !status.isIgnored && status.isSelected;
        });
    }, [allWords, localWordStatus]);

    const toggleWordSelection = (wordId: string, currentSelected: boolean) => {
        // Optimistic update
        setLocalWordStatus(prev => ({
            ...prev,
            [wordId]: { ...prev[wordId], isSelected: !currentSelected }
        }));

        fetcher.submit(
            { intent: "toggle-select-word", wordId, isSelected: String(currentSelected) },
            { method: "post" }
        );
    };

    const toggleSelectAll = () => {
        const nonIgnored = allWords.filter(w => !localWordStatus[w.id]?.isIgnored);
        const allSelected = nonIgnored.every(w => localWordStatus[w.id]?.isSelected);
        const nextSelected = !allSelected;

        // Optimistic update
        setLocalWordStatus(prev => {
            const next = { ...prev };
            nonIgnored.forEach(w => {
                next[w.id] = { ...next[w.id], isSelected: nextSelected };
            });
            return next;
        });

        fetcher.submit(
            { intent: "toggle-select-all", select: String(!allSelected) },
            { method: "post" }
        );
    };

    const toggleIgnoreWord = (wordId: string, currentIgnored: boolean) => {
        // Optimistic update
        setLocalWordStatus(prev => ({
            ...prev,
            [wordId]: { isIgnored: !currentIgnored, isSelected: false }
        }));

        fetcher.submit(
            { intent: "toggle-ignore-word", wordId, isIgnored: String(currentIgnored) },
            { method: "post" }
        );
    };

    const [phase, setPhase] = useState<Phase>("preview");
    const [currentCard, setCurrentCard] = useState(0);

    // Helper functions moved up to avoid ReferenceError
    const speak = (text: string) => {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    };

    const getViType = (type: string) => {
        const types = type.split(',').map(t => t.trim().toLowerCase());
        return types.map(t => {
            if (t.includes('noun')) return 'Danh từ';
            if (t.includes('verb')) return 'Động từ';
            if (t.includes('adj')) return 'Tính từ';
            if (t.includes('adv')) return 'Trạng từ';
            return t;
        });
    };

    // Matching State
    const [matchingItems, setMatchingItems] = useState<{ id: string, text: string, type: 'en' | 'vi', wordId: string, isMatched: boolean }[]>([]);
    const [selectedMatch, setSelectedMatch] = useState<string | null>(null); // Current selected item ID

    // Spelling State
    const [spellingIndex, setSpellingIndex] = useState(0);
    const [spelledWord, setSpelledWord] = useState<{ char: string, originalIndex: number }[]>([]);
    const [shuffledLetters, setShuffledLetters] = useState<{ char: string, isPicked: boolean }[]>([]);

    // Quiz State
    const [quizIndex, setQuizIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

    // Prepare quiz options
    const quizQuestions = useMemo(() => {
        return activeWords.map(word => {
            const others = activeWords.filter(w => w.id !== word.id);
            const distractors = others.length >= 3
                ? others.sort(() => 0.5 - Math.random()).slice(0, 3)
                : others;
            const options = [word, ...distractors].sort(() => 0.5 - Math.random());
            return { word, options };
        });
    }, [activeWords]);

    // Initialize Matching phase
    const initMatching = () => {
        const items: any[] = [];
        activeWords.forEach(w => {
            items.push({ id: `en-${w.id}`, text: w.term, type: 'en', wordId: w.id, isMatched: false });
            items.push({ id: `vi-${w.id}`, text: (w as any).translation, type: 'vi', wordId: w.id, isMatched: false });
        });
        setMatchingItems(items.sort(() => 0.5 - Math.random()));
        setSelectedMatch(null);
    };

    const handleMatchClick = (itemId: string) => {
        if (matchingItems.find(i => i.id === itemId)?.isMatched) return;

        if (!selectedMatch) {
            setSelectedMatch(itemId);
            const item = matchingItems.find(i => i.id === itemId);
            if (item?.type === 'en') speak(item.text);
            return;
        }

        const first = matchingItems.find(i => i.id === selectedMatch)!;
        const second = matchingItems.find(i => i.id === itemId)!;

        // If clicking same item, deselect
        if (selectedMatch === itemId) {
            setSelectedMatch(null);
            return;
        }

        // If same type (both English or both Vietnamese), just change selection
        if (first.type === second.type) {
            setSelectedMatch(itemId);
            if (second.type === 'en') speak(second.text);
            return;
        }

        // Check if they match
        if (first.wordId === second.wordId) {
            // Correct match
            if (second.type === 'en') speak(second.text);
            setMatchingItems(prev => prev.map(item =>
                (item.id === selectedMatch || item.id === itemId)
                    ? { ...item, isMatched: true }
                    : item
            ));
            setSelectedMatch(null);

            // Check if all matched
            const allMatched = matchingItems.filter(i => !i.isMatched).length === 2;
            if (allMatched) {
                setTimeout(() => setPhase("quiz"), 1000);
            }
        } else {
            // Wrong match - visual shake handled in render
            setSelectedMatch(itemId);
            if (second.type === 'en') speak(second.text);
        }
    };

    // Initialize spelling letters when entering or changing word in spelling phase
    const initSpelling = (index: number) => {
        const word = activeWords[index].term.toUpperCase();
        const letters = word.replace(/\s/g, "").split("").map(char => ({ char, isPicked: false })).sort(() => 0.5 - Math.random());
        setShuffledLetters(letters);
        setSpelledWord([]);
        setSpellingIndex(index);
    };

    const nextLearningCard = () => {
        if (currentCard < activeWords.length - 1) {
            setCurrentCard(p => p + 1);
        } else {
            initMatching();
            setPhase("matching");
        }
    };

    const skipPhase = () => {
        if (phase === "learning") {
            initMatching();
            setPhase("matching");
        } else if (phase === "matching") {
            setPhase("quiz");
        } else if (phase === "quiz") {
            initSpelling(0);
            setPhase("spelling");
        } else if (phase === "spelling") {
            setPhase("completed");
        }
    };

    const handleSpellingLetter = (char: string, index: number) => {
        if (shuffledLetters[index].isPicked) return;

        const targetWord = activeWords[spellingIndex].term.toUpperCase();
        const targetWordNoSpaces = targetWord.replace(/\s/g, "");
        const nextSpelled = [...spelledWord, { char, originalIndex: index }];

        const newShuffled = [...shuffledLetters];
        newShuffled[index].isPicked = true;

        setShuffledLetters(newShuffled);
        setSpelledWord(nextSpelled);

        const currentSpelledStr = nextSpelled.map(s => s.char).join("");

        if (currentSpelledStr.length === targetWordNoSpaces.length) {
            if (currentSpelledStr === targetWordNoSpaces) {
                // Correct!
                speak(activeWords[spellingIndex].term);
                setTimeout(() => {
                    if (spellingIndex < activeWords.length - 1) {
                        initSpelling(spellingIndex + 1);
                    } else {
                        setPhase("completed");
                    }
                }, 1000);
            } else {
                // Wrong - user can undo or show answer
            }
        }
    };

    const undoLastLetter = () => {
        if (spelledWord.length === 0) return;

        const last = spelledWord[spelledWord.length - 1];
        const newSpelled = spelledWord.slice(0, -1);

        const newShuffled = [...shuffledLetters];
        // If originalIndex is -1, it means it was forced by 'Show Answer', so we don't need to unpick
        if (last.originalIndex !== -1) {
            newShuffled[last.originalIndex].isPicked = false;
        }

        setShuffledLetters(newShuffled);
        setSpelledWord(newSpelled);
    };

    const showAnswer = () => {
        const term = activeWords[spellingIndex].term;
        const targetWord = term.toUpperCase();
        const targetWordNoSpaces = targetWord.replace(/\s/g, "");
        const letters = targetWordNoSpaces.split("").map(char => ({ char, originalIndex: -1 }));
        setSpelledWord(letters);
        // Mark all as picked
        setShuffledLetters(shuffledLetters.map(l => ({ ...l, isPicked: true })));

        speak(term);

        setTimeout(() => {
            if (spellingIndex < activeWords.length - 1) {
                initSpelling(spellingIndex + 1);
            } else {
                setPhase("completed");
            }
        }, 4000);
    };

    const handleQuizAnswer = (optionTerm: string) => {
        if (selectedOption) return;

        setSelectedOption(optionTerm);
        const correct = optionTerm === quizQuestions[quizIndex].word.term;
        setIsCorrect(correct);
        if (correct) {
            setScore(s => s + 1);
            speak(optionTerm);
        }

        setTimeout(() => {
            setSelectedOption(null);
            setIsCorrect(null);
            if (quizIndex < quizQuestions.length - 1) {
                setQuizIndex(i => i + 1);
            } else {
                initSpelling(0);
                setPhase("spelling");
            }
        }, 1500);
    };

    // --- Renderers ---

    if (phase === "preview") {
        return (
            <div className="min-h-[calc(100vh-70px)] bg-gray-50 py-6 md:py-12 px-4 font-sans">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-6 md:mb-12">
                        <span className="text-primary font-black tracking-widest uppercase text-xs bg-primary/10 px-4 py-1.5 rounded-full border border-primary/10">
                            {(topic as any).level === 'Beginner' ? 'Cơ bản' : (topic as any).level === 'Intermediate' ? 'Trung cấp' : 'Nâng cao'}
                        </span>
                        <h1 className="text-2xl md:text-5xl font-black text-gray-900 mt-4 md:mt-6 mb-2 md:mb-4 leading-tight">{(topic as any).viTitle || (topic as any).title}</h1>
                        <p className="text-gray-500 text-sm md:text-lg font-medium max-w-2xl mx-auto">{(topic as any).viDescription || topic.description}</p>
                    </div>

                    <div className="bg-white rounded-2xl md:rounded-[2rem] shadow-xl md:shadow-2xl border border-gray-100 overflow-hidden mb-6 md:mb-10">
                        {/* Header - Stacked on mobile */}
                        <div className="p-4 md:p-8 bg-gray-50/50 border-b border-gray-100">
                            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="font-black text-lg md:text-xl text-gray-800">Nội dung bài học</h2>
                                        <p className="text-xs md:text-sm text-gray-400 font-bold uppercase tracking-tighter mt-1">{words.length} từ vựng</p>
                                    </div>
                                    <div className="md:hidden w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary text-lg font-bold">
                                        {words.length}
                                    </div>
                                </div>

                                {/* Controls - Scrollable on mobile */}
                                <div className="flex flex-col gap-3">
                                    <div className="flex overflow-x-auto pb-1 scrollbar-hide gap-2">
                                        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 flex-shrink-0">
                                            <button
                                                onClick={toggleSelectAll}
                                                className="px-2 md:px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all text-slate-500 hover:bg-white hover:text-slate-800 whitespace-nowrap"
                                            >
                                                {allWords.filter((w: any) => !localWordStatus[w.id]?.isIgnored && localWordStatus[w.id]?.isSelected).length === allWords.filter((w: any) => !localWordStatus[w.id]?.isIgnored).length ? "🧊 Bỏ chọn" : "✅ Chọn hết"}
                                            </button>
                                        </div>
                                        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 flex-shrink-0">
                                            {[
                                                { id: 'active', label: '📖', fullLabel: '📖 Đang học', color: 'bg-primary' },
                                                { id: 'ignored', label: '🗑️', fullLabel: '🗑️ Bỏ qua', color: 'bg-red-500' },
                                                { id: 'all', label: '📚', fullLabel: '📚 Tất cả', color: 'bg-slate-600' }
                                            ].map((f) => (
                                                <button
                                                    key={f.id}
                                                    onClick={() => setFilter(f.id as any)}
                                                    className={`px-2 md:px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap ${filter === f.id
                                                        ? `${f.color} text-white shadow-sm`
                                                        : "text-slate-400 hover:text-slate-600"
                                                        }`}
                                                >
                                                    <span className="md:hidden">{f.label}</span>
                                                    <span className="hidden md:inline">{f.fullLabel}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* AI Generate Form */}
                                    <fetcher.Form method="post" className="flex items-center gap-2">
                                        <input type="hidden" name="intent" value="generate-words" />
                                        <div className="relative flex items-center bg-slate-100 rounded-xl border border-gray-200 p-1 group flex-shrink-0">
                                            <span className="pl-2 pr-1 text-[10px] font-black text-gray-400 uppercase">Thêm</span>
                                            <input
                                                type="number"
                                                name="count"
                                                value={aiWordCount}
                                                onChange={(e) => setAiWordCount(Math.min(Math.max(parseInt(e.target.value) || 1, 1), 15))}
                                                min="1"
                                                max="15"
                                                className="w-8 bg-transparent text-center font-black text-slate-800 focus:outline-none text-sm"
                                            />
                                            <span className="pr-2 text-[10px] font-black text-gray-400 uppercase">từ</span>
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={isGenerating}
                                            className="flex-1 md:flex-none px-4 py-2 bg-slate-900 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg active:scale-95"
                                        >
                                            {isGenerating ? (
                                                <span className="flex items-center gap-2">
                                                    <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                    AI...
                                                </span>
                                            ) : (
                                                <span>✨ AI Tạo</span>
                                            )}
                                        </button>
                                        {fetcher.data?.error && (
                                            <span className="text-xs text-red-500 font-bold">{fetcher.data.error}</span>
                                        )}
                                    </fetcher.Form>
                                </div>

                                {/* Word count badge - Desktop only */}
                                <div className="hidden md:flex w-12 h-12 bg-primary/10 rounded-2xl items-center justify-center text-primary text-xl font-bold flex-shrink-0">
                                    {words.length}
                                </div>
                            </div>
                        </div>

                        <div className="divide-y divide-gray-50">
                            {/* Debug Info */}
                            <div className="hidden">{allWords.length} words loaded</div>

                            {words.length === 0 ? (
                                <div className="p-20 text-center">
                                    <div className="text-6xl mb-6">✨</div>
                                    <h3 className="text-2xl font-black text-gray-900 mb-2">Chủ đề này chưa có từ vựng</h3>
                                    <p className="text-gray-500 font-medium max-w-sm mx-auto">Sử dụng nút "✨ AI Tạo" ở trên để tự động tạo danh sách từ vựng thông minh cho chủ đề này!</p>
                                </div>
                            ) : words.map((w: any, idx: number) => {
                                const status = localWordStatus[w.id] || { isIgnored: false, isSelected: false };
                                const isIgnored = status.isIgnored;
                                const isSelected = status.isSelected;
                                return (
                                    <div key={w.id} className={`p-4 md:p-6 transition-all group border-b border-gray-50 last:border-0 ${isIgnored ? 'bg-gray-100/50 opacity-60' : isSelected ? 'bg-primary/[0.02]' : 'hover:bg-gray-50'}`}>
                                        <div className="flex gap-3 md:gap-6">
                                            {/* Left side - Number and actions */}
                                            <div className="flex-shrink-0 flex flex-col items-center gap-2 md:gap-3">
                                                {!isIgnored && (
                                                    <button
                                                        onClick={() => toggleWordSelection(w.id, isSelected)}
                                                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all touch-target ${isSelected ? "bg-primary border-primary text-white" : "border-gray-200 hover:border-primary"
                                                            }`}
                                                    >
                                                        {isSelected && <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>}
                                                    </button>
                                                )}
                                                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center text-sm md:text-lg font-black transition-all ${isIgnored ? 'bg-gray-200 text-gray-400' : isSelected ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'
                                                    }`}>
                                                    {idx + 1}
                                                </div>

                                                <button
                                                    onClick={() => toggleIgnoreWord(w.id, isIgnored)}
                                                    title={isIgnored ? "Khôi phục từ" : "Bỏ qua từ này"}
                                                    className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center transition-all touch-target ${isIgnored
                                                        ? "bg-green-100 text-green-600 hover:bg-green-200"
                                                        : "bg-red-50 text-red-300 hover:bg-red-500 hover:text-white"
                                                        }`}
                                                >
                                                    {isIgnored ? (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                                                        </svg>
                                                    ) : (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                                        </svg>
                                                    )}
                                                </button>
                                            </div>

                                            {/* Right side - Word content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                    <h3 className={`font-black text-lg md:text-2xl ${isIgnored ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{w.term}</h3>
                                                    <span className="font-mono text-[9px] md:text-[10px] font-black text-primary bg-primary/5 px-1.5 py-0.5 rounded uppercase border border-primary/10">
                                                        {w.type}
                                                    </span>
                                                </div>
                                                {w.phonetic && <p className="text-gray-400 font-medium text-xs md:text-sm mb-2">{w.phonetic}</p>}

                                                <div className="mb-3">
                                                    <div className={`text-base md:text-xl font-black leading-tight ${isIgnored ? 'text-gray-400' : 'text-primary'}`}>
                                                        {(w as any).translation || "Chưa có dịch"}
                                                    </div>
                                                    <div className="text-gray-500 font-medium italic text-xs md:text-sm mt-1 line-clamp-2">
                                                        {(w as any).viDefinition || w.definition}
                                                    </div>
                                                </div>

                                                <div className={`rounded-xl p-3 border transition-colors ${isIgnored ? 'bg-gray-100 border-gray-200' : 'bg-gray-50 border-gray-100'
                                                    }`}>
                                                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Ví dụ</div>
                                                    <p className={`font-medium text-xs md:text-sm mb-1 ${isIgnored ? 'text-gray-400' : 'text-gray-700'}`}>"{w.example}"</p>
                                                    {(w as any).viExample && (
                                                        <p className="text-gray-400 text-xs font-medium italic">→ {(w as any).viExample}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="sticky bottom-4 md:bottom-8 max-w-md mx-auto px-2">
                        {activeWords.length > 0 ? (
                            <button
                                onClick={() => setPhase("learning")}
                                className="w-full py-4 md:py-6 bg-primary text-white font-black text-lg md:text-2xl rounded-xl md:rounded-2xl shadow-glow-primary hover:bg-primary-dark hover:-translate-y-1 transition-all active:translate-y-0 flex items-center justify-center gap-3 touch-target"
                            >
                                <span>Bắt đầu học {activeWords.length} từ</span>
                                <span className="text-2xl md:text-3xl">🚀</span>
                            </button>
                        ) : words.length === 0 ? (
                            <div className="bg-primary/10 border-2 border-primary/20 p-6 rounded-2xl text-center shadow-lg backdrop-blur-sm animate-bounce">
                                <p className="text-primary font-black text-sm flex items-center justify-center gap-2">
                                    <span>☝️</span> Nhấn "AI Tạo" để bắt đầu!
                                </p>
                            </div>
                        ) : (
                            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-center shadow-lg">
                                <p className="text-amber-800 font-bold text-sm">Vui lòng chọn ít nhất 1 từ vựng để bắt đầu học!</p>
                            </div>
                        )}
                        <div className="text-center mt-6 flex flex-wrap items-center justify-center gap-4">
                            <Link to="/" className="text-gray-400 hover:text-gray-600 transition-colors font-black text-xs uppercase tracking-widest">🏠 Trang chủ</Link>
                            <Link to="/topics" className="text-gray-400 hover:text-gray-600 transition-colors font-black text-xs uppercase tracking-widest">📚 Danh sách chủ đề</Link>
                            {words.length >= 4 && (
                                <Link
                                    to={`/quiz/${(topic as any).slug}`}
                                    className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:shadow-lg transition-all"
                                >
                                    📝 Làm bài kiểm tra
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (phase === "matching") {
        const matchedCount = matchingItems.filter(i => i.isMatched).length / 2;
        const progress = (matchedCount / words.length) * 100;

        return (
            <div className="min-h-[calc(100vh-70px)] bg-slate-900 text-white flex flex-col font-sans">
                <div className="w-full bg-slate-800 h-2">
                    <div className="bg-primary transition-all duration-500 shadow-glow-primary" style={{ width: `${progress}%`, height: '100%' }}></div>
                </div>

                <div className="flex-1 container mx-auto px-4 flex flex-col items-center py-12">
                    <div className="w-full max-w-4xl mb-8 flex justify-between items-center text-slate-500">
                        <div className="flex items-center gap-3">
                            <span className="font-black bg-slate-800 px-4 py-1.5 rounded-full border border-slate-700 text-xs text-primary-light uppercase tracking-widest leading-none">
                                Thử thách ghép mảnh
                            </span>
                            <button onClick={skipPhase} className="text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-primary transition-colors">
                                (Bỏ qua →)
                            </button>
                        </div>
                        <span className="font-black text-xs uppercase tracking-widest">
                            {matchedCount} / {activeWords.length} cặp đã xong
                        </span>
                    </div>

                    <div className="w-full max-w-2xl text-center mb-10">
                        <h2 className="text-3xl font-black text-white mb-2">Nối từ tương ứng</h2>
                        <p className="text-slate-500 font-medium">Chọn một từ tiếng Anh và nghĩa tiếng Việt tương ứng</p>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-5xl">
                        {matchingItems.map((item) => {
                            const isSelected = selectedMatch === item.id;
                            const isMatched = item.isMatched;

                            let baseClasses = "relative p-5 rounded-2xl border-2 font-bold text-lg transition-all text-center flex items-center justify-center min-h-[120px] overflow-hidden group ";

                            // Color based on type
                            let typeClasses = item.type === 'en'
                                ? "border-sky-500/30 bg-sky-500/5 text-sky-400 hover:bg-sky-500/10 "
                                : "border-amber-500/30 bg-amber-500/5 text-amber-400 hover:bg-amber-500/10 ";

                            if (isMatched) {
                                baseClasses += "opacity-0 scale-90 pointer-events-none ";
                            } else if (isSelected) {
                                baseClasses += item.type === 'en'
                                    ? "border-sky-500 bg-sky-400 text-white shadow-glow-sky scale-105 z-10 "
                                    : "border-amber-500 bg-amber-400 text-white shadow-glow-amber scale-105 z-10 ";
                            } else {
                                baseClasses += typeClasses;
                            }

                            return (
                                <button
                                    key={item.id}
                                    onClick={() => handleMatchClick(item.id)}
                                    className={baseClasses}
                                >
                                    <span className={`absolute top-2 left-2 text-[8px] uppercase tracking-tighter px-1.5 py-0.5 rounded border ${item.type === 'en' ? 'border-sky-500/50 text-sky-500' : 'border-amber-500/50 text-amber-500'
                                        } ${isSelected ? 'bg-white text-slate-900 border-white' : ''}`}>
                                        {item.type === 'en' ? 'ENG' : 'VIE'}
                                    </span>

                                    <span className="relative z-10 leading-tight">{item.text}</span>

                                    <div className={`absolute -right-4 -bottom-4 text-4xl opacity-[0.03] font-black group-hover:opacity-[0.07] transition-opacity`}>
                                        {item.type === 'en' ? 'EN' : 'VN'}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {matchedCount === activeWords.length && (
                        <div className="mt-12 text-green-400 font-black flex items-center gap-2 animate-pulse">
                            🎉 Tuyệt vời! Bạn đã ghép đúng tất cả.
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (phase === "spelling") {
        const word = activeWords[spellingIndex];
        const targetWord = word.term.toUpperCase();
        const targetWordNoSpaces = targetWord.replace(/\s/g, "");
        const progress = (spellingIndex / activeWords.length) * 100;
        const spelledStr = spelledWord.map(s => s.char).join("");
        const isWrong = spelledStr.length === targetWordNoSpaces.length && spelledStr !== targetWordNoSpaces;
        const isCorrectSpelling = spelledStr === targetWordNoSpaces;

        return (
            <div className="min-h-[calc(100vh-70px)] bg-slate-900 text-white flex flex-col font-sans">
                <div className="w-full bg-slate-800 h-2">
                    <div className="bg-primary transition-all duration-500 shadow-glow-primary" style={{ width: `${progress}%`, height: '100%' }}></div>
                </div>

                <div className="flex-1 container mx-auto px-4 flex flex-col items-center py-12">
                    <div className="w-full max-w-2xl mb-8 flex justify-between items-center text-slate-500">
                        <div className="flex items-center gap-3">
                            <span className="font-black bg-slate-800 px-4 py-1.5 rounded-full border border-slate-700 text-xs text-primary-light uppercase tracking-widest leading-none">
                                Phase 2: Thử thách ghép chữ
                            </span>
                            <button onClick={skipPhase} className="text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-primary transition-colors">
                                (Bỏ qua →)
                            </button>
                        </div>
                        <div className="flex gap-4 items-center">
                            <button onClick={showAnswer} className="text-[10px] font-black uppercase tracking-widest bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded-lg border border-slate-700 transition-colors">
                                Xem đáp án
                            </button>
                            <span className="font-black text-xs uppercase tracking-widest">
                                {spellingIndex + 1} / {activeWords.length}
                            </span>
                        </div>
                    </div>

                    <div className="w-full max-w-2xl text-center mb-12">
                        <h3 className="text-gray-400 font-black text-xs uppercase tracking-[0.3em] mb-4">Nghĩa của từ:</h3>
                        <div className="text-4xl md:text-5xl font-black text-primary-light mb-4">{(word as any).translation}</div>
                        <p className="text-slate-500 italic">{(word as any).viDefinition}</p>
                    </div>

                    {/* Word Slots */}
                    <div className="flex flex-wrap justify-center gap-2 mb-12">
                        {targetWord.split("").map((char, i) => {
                            // Calculate which char from spelledWord should be here
                            const precedingNonSpaces = targetWord.slice(0, i).replace(/\s/g, "").length;
                            const isSpace = char === " ";
                            const displayChar = isSpace ? " " : (spelledWord[precedingNonSpaces]?.char || "");
                            const isFilled = isSpace || !!spelledWord[precedingNonSpaces];

                            return (
                                <div
                                    key={i}
                                    onClick={() => !isSpace && precedingNonSpaces === spelledWord.length - 1 && spelledWord[precedingNonSpaces] && undoLastLetter()}
                                    className={`w-12 h-16 md:w-16 md:h-20 rounded-2xl border-2 flex items-center justify-center text-3xl md:text-4xl font-black transition-all shadow-lg 
                                        ${isSpace ? 'border-transparent bg-transparent w-6 md:w-8' :
                                            isFilled ? 'bg-primary border-primary text-white scale-105 cursor-pointer' : 'bg-slate-800 border-slate-700 text-transparent'}
                                        ${isWrong && !isSpace ? 'border-red-500 bg-red-500 animate-shake' : ''}
                                        ${isCorrectSpelling && !isSpace ? 'bg-green-500 border-green-500' : ''}
                                        ${!isSpace && precedingNonSpaces === spelledWord.length - 1 && spelledWord[precedingNonSpaces] ? 'hover:scale-110 active:scale-95' : ''}
                                    `}
                                >
                                    {displayChar}
                                </div>
                            );
                        })}
                    </div>

                    {/* Pickable Letters */}
                    <div className="grid grid-cols-4 md:grid-cols-6 gap-3 max-w-xl w-full">
                        {shuffledLetters.map((l, i) => (
                            <button
                                key={i}
                                disabled={l.isPicked}
                                onClick={() => handleSpellingLetter(l.char, i)}
                                className={`h-16 md:h-20 border-2 rounded-2xl flex items-center justify-center text-2xl md:text-3xl font-black shadow-xl transition-all
                                    ${l.isPicked
                                        ? 'bg-slate-800/30 border-slate-800 text-slate-700 cursor-not-allowed scale-90'
                                        : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-white active:scale-95 hover:border-primary-light/30'}
                                `}
                            >
                                {l.char}
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-6 mt-12">
                        <button
                            onClick={undoLastLetter}
                            disabled={spelledWord.length === 0}
                            className="text-slate-500 hover:text-white transition-colors font-black text-xs uppercase tracking-widest flex items-center gap-2 disabled:opacity-30"
                        >
                            <span>⌫</span> Xóa chữ cuối
                        </button>
                        <button
                            onClick={() => initSpelling(spellingIndex)}
                            className="text-slate-500 hover:text-primary transition-colors font-black text-xs uppercase tracking-widest flex items-center gap-2"
                        >
                            <span>🔄</span> Làm lại từ đầu
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (phase === "quiz") {
        const question = quizQuestions[quizIndex];
        const progress = ((quizIndex) / quizQuestions.length) * 100;

        return (
            <div className="min-h-[calc(100vh-70px)] bg-slate-900 text-white flex flex-col">
                <div className="w-full bg-slate-800 h-2">
                    <div className="bg-primary transition-all duration-500" style={{ width: `${progress}%`, height: '100%' }}></div>
                </div>

                <div className="flex-1 container mx-auto px-4 flex flex-col items-center justify-center py-12">
                    <div className="w-full max-w-2xl mb-8 flex justify-between items-center text-slate-500">
                        <button onClick={skipPhase} className="text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-primary transition-colors">
                            (Bỏ qua phần Quiz →)
                        </button>
                        <div className="text-slate-600 font-black text-xs uppercase tracking-widest">
                            Câu hỏi {quizIndex + 1} / {quizQuestions.length}
                        </div>
                    </div>

                    <div className="w-full max-w-2xl mb-12 text-center">
                        <span className="inline-block px-4 py-1 rounded-full bg-slate-800 text-primary-light text-xs font-bold uppercase tracking-widest mb-4">Challenge Mode</span>
                        <h2 className="text-2xl md:text-3xl font-bold text-slate-300">Chọn từ đúng cho nghĩa này:</h2>
                        <div className="mt-8 p-10 bg-slate-900/50 rounded-3xl border border-slate-800 shadow-2xl">
                            <p className="text-3xl md:text-4xl font-black text-white leading-tight">
                                "{(question.word as any).translation || question.word.definition}"
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
                        {question.options.map((option) => {
                            const isSelected = selectedOption === option.term;
                            const isCorrectTerm = option.term === question.word.term;

                            let classes = "p-5 rounded-2xl border-2 font-bold text-xl transition-all text-left flex items-center justify-between ";
                            if (!selectedOption) {
                                classes += "border-slate-700 bg-slate-800 hover:border-primary hover:bg-slate-700 active:scale-95";
                            } else {
                                if (isCorrectTerm) {
                                    classes += "border-green-500 bg-green-500/20 text-green-400";
                                } else if (isSelected) {
                                    classes += "border-red-500 bg-red-500/20 text-red-400";
                                } else {
                                    classes += "border-slate-700 bg-slate-800 opacity-50";
                                }
                            }

                            return (
                                <button
                                    key={option.id}
                                    disabled={!!selectedOption}
                                    onClick={() => handleQuizAnswer(option.term)}
                                    className={classes}
                                >
                                    {option.term}
                                    {selectedOption && isCorrectTerm && <span>✅</span>}
                                    {selectedOption && isSelected && !isCorrectTerm && <span>❌</span>}
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-12 text-slate-600 font-black text-xs uppercase tracking-widest">
                        Câu hỏi {quizIndex + 1} / {quizQuestions.length}
                    </div>
                </div>
            </div>
        );
    }

    if (phase === "completed") {
        return (
            <div className="min-h-[calc(100vh-70px)] bg-white flex flex-col items-center justify-center p-4 text-center overflow-hidden relative">
                <div className="absolute inset-0 pointer-events-none opacity-20">
                    <div className="animate-bounce absolute top-10 left-1/4 text-4xl">🎉</div>
                    <div className="animate-bounce absolute top-40 right-1/4 text-4xl delay-300">⭐</div>
                    <div className="animate-pulse absolute bottom-20 left-1/3 text-4xl delay-700">✨</div>
                </div>

                <div className="z-10 max-w-md w-full">
                    <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-5xl mx-auto mb-8 shadow-inner animate-bounce">
                        🎓
                    </div>
                    <h1 className="text-4xl font-black text-gray-900 mb-2">Tuyệt vời!</h1>
                    <p className="text-gray-500 text-xl font-medium mb-10">Bạn đã hoàn thành bộ từ vựng <span className="text-primary font-black">{(topic as any).viTitle || topic.title}</span>.</p>

                    <div className="bg-gray-50 rounded-3xl p-8 mb-10 border border-gray-100 flex justify-around">
                        <div>
                            <div className="text-3xl font-black text-gray-900">{score}/{activeWords.length}</div>
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Accuracy</div>
                        </div>
                        <div className="w-px bg-gray-200" />
                        <div>
                            <div className="text-3xl font-black text-gray-900">+{score * 10}</div>
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Exp Gained</div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <Link to="/topics" className="block w-full py-5 bg-primary text-white font-black text-lg rounded-2xl shadow-lg hover:bg-primary-dark transition-all">
                            Học chủ đề khác
                        </Link>
                        <button onClick={() => window.location.reload()} className="block w-full py-5 bg-gray-100 text-gray-700 font-black text-lg rounded-2xl hover:bg-gray-200 transition-all">
                            Ôn lại lần nữa
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Default: Learning Phase
    const word = activeWords[currentCard];
    const learningProgress = (currentCard / activeWords.length) * 100;
    const viTypes = getViType(word.type || '');

    return (
        <div className="min-h-[calc(100vh-70px)] bg-gray-50 flex flex-col pb-20 font-sans">
            <div className="w-full bg-white border-b border-gray-100 h-1.5 md:h-2">
                <div className="bg-primary transition-all duration-700 shadow-glow" style={{ width: `${learningProgress}%`, height: '100%' }}></div>
            </div>

            <div className="flex-1 container mx-auto px-3 md:px-4 flex flex-col items-center py-6 md:py-12">
                {/* Header */}
                <div className="w-full max-w-2xl mb-4 md:mb-10 flex justify-between items-center text-gray-400">
                    <div className="flex items-center gap-2 md:gap-6">
                        <button onClick={() => setPhase("preview")} className="hover:text-primary transition-colors font-black text-xs md:text-sm flex items-center gap-1 md:gap-2 group">
                            <span className="text-lg md:text-xl group-hover:-translate-x-1 transition-transform">←</span>
                            <span className="hidden sm:inline">Quay lại</span>
                        </button>
                        <button onClick={skipPhase} className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-300 hover:text-primary transition-colors">
                            (Bỏ qua →)
                        </button>
                    </div>
                    <span className="font-black bg-white px-2 md:px-4 py-1 md:py-1.5 rounded-full border border-gray-100 shadow-sm text-[10px] md:text-xs text-primary uppercase tracking-widest leading-none">
                        {currentCard + 1} / {activeWords.length}
                    </span>
                </div>

                {/* Study Card */}
                <div className="w-full max-w-2xl bg-white rounded-2xl md:rounded-[3rem] shadow-2xl border border-gray-100 overflow-hidden mb-6 md:mb-12">
                    {/* Hero Section: English Word */}
                    <div className="bg-slate-900 p-6 md:p-12 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"></div>
                        <div className="flex flex-wrap justify-center gap-2 md:gap-3 mb-3 md:mb-4">
                            {viTypes.map((t, i) => (
                                <span key={i} className="inline-block px-2 md:px-4 py-0.5 md:py-1 rounded-full bg-primary/20 text-primary-light text-[8px] md:text-[10px] font-black uppercase tracking-[0.15em] md:tracking-[0.2em] border border-primary/20">
                                    {t}
                                </span>
                            ))}
                        </div>

                        <div className="relative inline-block mb-2 md:mb-4 group/word max-w-full">
                            <h2 className="text-3xl sm:text-4xl md:text-6xl lg:text-8xl font-black text-white tracking-tighter break-words overflow-wrap-anywhere">{word.term}</h2>
                            <button
                                onClick={() => speak(word.term)}
                                className="absolute -right-8 md:-right-12 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 bg-primary/20 hover:bg-primary text-primary-light hover:text-white rounded-full flex items-center justify-center transition-all shadow-lg border border-primary/30 group-hover/word:scale-110 active:scale-90 touch-target"
                                title="Phát âm"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.983 5.983 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.984 3.984 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>

                        {word.phonetic && (
                            <div className="text-slate-400 font-mono text-sm md:text-xl">{word.phonetic}</div>
                        )}
                        <div className="absolute -right-6 md:-right-10 -bottom-6 md:-bottom-10 text-[6rem] md:text-[12rem] text-white/5 font-black select-none pointer-events-none uppercase">
                            {word.term.charAt(0)}
                        </div>
                    </div>

                    {/* Information Section */}
                    <div className="p-5 md:p-10 lg:p-14 space-y-6 md:space-y-12">
                        {/* Meanings & Roles Mapping */}
                        <div className="space-y-4 md:space-y-8">
                            <div className="flex flex-col items-center text-center">
                                <span className="text-gray-300 font-black text-[9px] md:text-[10px] uppercase tracking-widest mb-2 md:mb-3 leading-none">Nghĩa và Giải thích</span>
                                <div className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-primary mb-2 md:mb-4 leading-tight break-words">{(word as any).translation}</div>
                                <p className="text-gray-500 font-medium text-sm md:text-lg italic max-w-lg leading-relaxed break-words">
                                    {(word as any).viDefinition || word.definition}
                                </p>
                            </div>
                        </div>

                        {/* Usage Example */}
                        <div className="bg-gray-50 rounded-xl md:rounded-[2.5rem] p-4 md:p-8 lg:p-10 border border-gray-100 relative group">
                            <div className="absolute top-0 right-0 p-4 md:p-8 opacity-5 text-4xl md:text-8xl grayscale group-hover:grayscale-0 transition-all pointer-events-none">💬</div>
                            <h4 className="font-black text-gray-400 text-[9px] md:text-[10px] uppercase tracking-widest mb-3 md:mb-6 leading-none flex items-center gap-2">
                                <span className="w-3 md:w-4 h-px bg-gray-200"></span> Ví dụ sử dụng
                            </h4>
                            <div className="space-y-2 md:space-y-3">
                                <p className="text-gray-800 font-black text-base md:text-xl lg:text-2xl leading-tight break-words">"{word.example}"</p>
                                {(word as any).viExample && (
                                    <p className="text-gray-500 font-medium italic text-sm md:text-lg leading-relaxed break-words">→ {(word as any).viExample}</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Navigation Controls */}
                <div className="flex gap-2 md:gap-4 w-full max-w-xl px-2">
                    <button
                        onClick={() => nextLearningCard()}
                        className="flex-1 py-3 md:py-6 bg-white border-2 border-gray-100 text-gray-400 font-black text-sm md:text-base rounded-xl md:rounded-2xl hover:bg-gray-50 transition-all hover:border-gray-200 active:scale-95 touch-target"
                    >
                        Bỏ qua
                    </button>
                    <button
                        onClick={() => nextLearningCard()}
                        className="flex-[2] py-3 md:py-6 bg-primary text-white font-black text-base md:text-2xl rounded-xl md:rounded-2xl shadow-glow-primary hover:bg-primary-dark hover:-translate-y-1 transition-all active:translate-y-0 touch-target"
                    >
                        <span className="hidden sm:inline">Đã ghi nhớ! </span>
                        <span className="sm:hidden">Tiếp </span>🚀
                    </button>
                </div>

                <div className="mt-6 md:mt-10 text-gray-300 font-black text-[8px] md:text-[10px] uppercase tracking-[0.2em] md:tracking-[0.3em] flex items-center gap-2 md:gap-4">
                    <span className="w-6 md:w-10 h-px bg-gray-200"></span>
                    <span className="hidden sm:inline">LinguaFast Learning Experience</span>
                    <span className="sm:hidden">LinguaFast</span>
                    <span className="w-6 md:w-10 h-px bg-gray-200"></span>
                </div>
            </div>
        </div>
    );
}
