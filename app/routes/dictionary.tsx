import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLoaderData, useFetcher } from "react-router";
import type { Route } from "./+types/dictionary";
import { prisma } from "../utils/db.server";
import { lookupEnglishWords } from "../utils/ai.server";
import { toast } from "sonner";

const WORDS_PER_PAGE = 30;

export function meta({ }: Route.MetaArgs) {
    return [{ title: "Từ điển - LinguaFast" }];
}

export async function loader({ request }: Route.LoaderArgs) {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const search = url.searchParams.get("search") || "";
    const topicId = url.searchParams.get("topic") || "";

    const where: any = {};

    if (search) {
        where.OR = [
            { term: { contains: search, mode: "insensitive" } },
            { translation: { contains: search, mode: "insensitive" } },
            { definition: { contains: search, mode: "insensitive" } },
        ];
    }

    if (topicId === "uncategorized") {
        where.topicId = { isSet: false };
        console.log("[Dictionary] Filtering uncategorized words, where:", JSON.stringify(where));
    } else if (topicId) {
        where.topicId = topicId;
    }

    const [words, totalCount, topics] = await Promise.all([
        prisma.word.findMany({
            where,
            include: {
                topic: {
                    select: { id: true, title: true, viTitle: true, slug: true, color: true }
                }
            },
            orderBy: { term: "asc" },
            skip: (page - 1) * WORDS_PER_PAGE,
            take: WORDS_PER_PAGE,
        }),
        prisma.word.count({ where }),
        prisma.topic.findMany({
            select: { id: true, title: true, viTitle: true },
            orderBy: { title: "asc" }
        })
    ]);

    const hasMore = page * WORDS_PER_PAGE < totalCount;

    return { words, totalCount, hasMore, page, search, topicId, topics };
}

export async function action({ request }: Route.ActionArgs) {
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "lookup-word") {
        const vietnameseWord = formData.get("vietnameseWord") as string;

        if (!vietnameseWord || vietnameseWord.trim().length === 0) {
            return { error: "Vui lòng nhập từ tiếng Việt.", intent: "lookup-word" };
        }

        try {
            const results = await lookupEnglishWords(vietnameseWord.trim());
            return { success: true, intent: "lookup-word", lookupResults: results, searchTerm: vietnameseWord };
        } catch (error: any) {
            return { error: error.message || "Lỗi khi tra cứu.", intent: "lookup-word" };
        }
    }

    if (intent === "add-words") {
        const wordsJson = formData.get("words") as string;
        const targetTopicId = formData.get("targetTopicId") as string;

        if (!wordsJson) {
            return { error: "Thiếu thông tin.", intent: "add-words" };
        }

        try {
            const wordsToAdd = JSON.parse(wordsJson);
            let addedCount = 0;

            for (const w of wordsToAdd) {
                // Check if word already exists anywhere in the dictionary (by term)
                const existing = await prisma.word.findFirst({
                    where: { term: { equals: w.term, mode: "insensitive" } }
                });

                if (!existing) {
                    const wordData: any = {
                        term: w.term,
                        phonetic: w.phonetic,
                        type: w.type,
                        definition: w.definition,
                        viDefinition: w.viDefinition,
                        translation: w.translation,
                        example: w.example,
                        viExample: w.viExample,
                    };

                    if (targetTopicId) {
                        wordData.topicId = targetTopicId;
                    }

                    console.log("[Dictionary] Creating word:", w.term, "with topicId:", wordData.topicId || "NULL");
                    await prisma.word.create({ data: wordData });
                    addedCount++;
                }
            }

            console.log("[Dictionary] Added", addedCount, "words");
            return { success: true, intent: "add-words", addedCount };
        } catch (error: any) {
            return { error: error.message || "Lỗi khi thêm từ.", intent: "add-words" };
        }
    }

    if (intent === "move-word") {
        const wordId = formData.get("wordId") as string;
        const targetTopicId = formData.get("targetTopicId") as string;

        if (!wordId || !targetTopicId) {
            return { error: "Thiếu thông tin." };
        }

        try {
            await prisma.word.update({
                where: { id: wordId },
                data: { topicId: targetTopicId }
            });
            return { success: true, intent: "move-word" };
        } catch (error: any) {
            return { error: error.message || "Lỗi khi chuyển từ." };
        }
    }

    if (intent === "copy-word") {
        const wordId = formData.get("wordId") as string;
        const targetTopicId = formData.get("targetTopicId") as string;

        if (!wordId || !targetTopicId) {
            return { error: "Thiếu thông tin." };
        }

        try {
            const word = await prisma.word.findUnique({
                where: { id: wordId }
            });

            if (!word) {
                return { error: "Không tìm thấy từ vựng." };
            }

            // Check if word already exists anywhere in dictionary (global, case-insensitive)
            const existing = await prisma.word.findFirst({
                where: { term: { equals: word.term, mode: "insensitive" } }
            });

            if (existing && existing.id !== wordId) {
                return { error: `Từ "${word.term}" đã tồn tại trong từ điển.` };
            }

            await prisma.word.create({
                data: {
                    term: word.term,
                    phonetic: word.phonetic,
                    type: word.type,
                    definition: word.definition,
                    viDefinition: word.viDefinition,
                    translation: word.translation,
                    example: word.example,
                    viExample: word.viExample,
                    audio: word.audio,
                    topicId: targetTopicId
                }
            });

            return { success: true, intent: "copy-word" };
        } catch (error: any) {
            return { error: error.message || "Lỗi khi sao chép từ." };
        }
    }

    return { error: "Hành động không hợp lệ." };
}

type LookupWord = {
    term: string;
    phonetic: string;
    type: string;
    definition: string;
    translation: string;
    viDefinition: string;
    example: string;
    viExample: string;
};

export default function Dictionary() {
    const initialData = useLoaderData<typeof loader>();
    const fetcher = useFetcher<typeof loader>();
    const actionFetcher = useFetcher<typeof action>();

    const [words, setWords] = useState(initialData.words);
    const [page, setPage] = useState(initialData.page);
    const [hasMore, setHasMore] = useState(initialData.hasMore);
    const [search, setSearch] = useState(initialData.search);
    const [selectedTopic, setSelectedTopic] = useState(initialData.topicId);
    const [expandedWordId, setExpandedWordId] = useState<string | null>(null);
    const [addToTopicWordId, setAddToTopicWordId] = useState<string | null>(null);

    // Lookup state
    const [showLookup, setShowLookup] = useState(false);
    const [vietnameseInput, setVietnameseInput] = useState("");
    const [lookupResults, setLookupResults] = useState<LookupWord[]>([]);
    const [selectedLookupWords, setSelectedLookupWords] = useState<Set<number>>(new Set());
    const [lookupTargetTopic, setLookupTargetTopic] = useState("");

    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreRef = useRef<HTMLDivElement | null>(null);
    const isLoading = fetcher.state !== "idle";
    const isLookupLoading = actionFetcher.state !== "idle" && (actionFetcher.formData?.get("intent") === "lookup-word" || actionFetcher.formData?.get("intent") === "add-words");

    // Reset when search or topic changes
    useEffect(() => {
        setWords(initialData.words);
        setPage(initialData.page);
        setHasMore(initialData.hasMore);
        setExpandedWordId(null);
        setAddToTopicWordId(null);
    }, [initialData]);

    // Handle fetcher data
    useEffect(() => {
        if (fetcher.data && fetcher.state === "idle") {
            if (fetcher.data.page === 1) {
                setWords(fetcher.data.words);
            } else {
                setWords(prev => [...prev, ...fetcher.data!.words]);
            }
            setPage(fetcher.data.page);
            setHasMore(fetcher.data.hasMore);
        }
    }, [fetcher.data, fetcher.state]);

    // Handle action results
    useEffect(() => {
        if (actionFetcher.state === "idle" && actionFetcher.data) {
            const data = actionFetcher.data as any;
            if (data.success) {
                if (data.intent === "move-word") {
                    toast.success("Đã chuyển từ sang chủ đề mới!");
                } else if (data.intent === "copy-word") {
                    toast.success("Đã sao chép từ sang chủ đề mới!");
                } else if (data.intent === "lookup-word" && data.lookupResults) {
                    setLookupResults(data.lookupResults);
                    setSelectedLookupWords(new Set());
                } else if (data.intent === "add-words") {
                    toast.success(`Đã thêm ${data.addedCount} từ vào từ điển!`);
                    setLookupResults([]);
                    setSelectedLookupWords(new Set());
                    setVietnameseInput("");
                    setShowLookup(false);
                    // Reload to show new words
                    window.location.reload();
                }
                setAddToTopicWordId(null);
            } else if (data.error) {
                toast.error(data.error);
            }
        }
    }, [actionFetcher.state, actionFetcher.data]);

    // Infinite scroll observer
    const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
        const [target] = entries;
        if (target.isIntersecting && hasMore && !isLoading) {
            const nextPage = page + 1;
            const params = new URLSearchParams();
            params.set("page", String(nextPage));
            if (search) params.set("search", search);
            if (selectedTopic) params.set("topic", selectedTopic);
            fetcher.load(`/dictionary?${params.toString()}`);
        }
    }, [hasMore, isLoading, page, search, selectedTopic, fetcher]);

    useEffect(() => {
        if (observerRef.current) observerRef.current.disconnect();

        observerRef.current = new IntersectionObserver(handleObserver, {
            root: null,
            rootMargin: "100px",
            threshold: 0.1,
        });

        if (loadMoreRef.current) {
            observerRef.current.observe(loadMoreRef.current);
        }

        return () => observerRef.current?.disconnect();
    }, [handleObserver]);

    // Handle search submit
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const params = new URLSearchParams();
        params.set("page", "1");
        if (search) params.set("search", search);
        if (selectedTopic) params.set("topic", selectedTopic);
        fetcher.load(`/dictionary?${params.toString()}`);
    };

    // Handle topic filter
    const handleTopicChange = (topicId: string) => {
        setSelectedTopic(topicId);
        const params = new URLSearchParams();
        params.set("page", "1");
        if (search) params.set("search", search);
        if (topicId) params.set("topic", topicId);
        fetcher.load(`/dictionary?${params.toString()}`);
    };

    // Text-to-speech
    const speak = (text: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    };

    // Toggle expanded word
    const toggleExpand = (wordId: string) => {
        setExpandedWordId(prev => prev === wordId ? null : wordId);
        setAddToTopicWordId(null);
    };

    // Toggle add to topic dropdown
    const toggleAddToTopic = (wordId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setAddToTopicWordId(prev => prev === wordId ? null : wordId);
    };

    // Handle move/copy word
    const handleWordAction = (wordId: string, targetTopicId: string, action: 'move' | 'copy', e: React.MouseEvent) => {
        e.stopPropagation();
        actionFetcher.submit(
            { intent: action === 'move' ? 'move-word' : 'copy-word', wordId, targetTopicId },
            { method: "post" }
        );
    };

    // Lookup functions
    const handleLookup = (e: React.FormEvent) => {
        e.preventDefault();
        if (!vietnameseInput.trim()) return;
        actionFetcher.submit(
            { intent: "lookup-word", vietnameseWord: vietnameseInput },
            { method: "post" }
        );
    };

    // Find similar words based on a word's Vietnamese translation
    const findSimilarWords = (translation: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!translation) return;

        setShowLookup(true);
        setVietnameseInput(translation);
        setLookupResults([]);
        setSelectedLookupWords(new Set());

        // Trigger lookup
        actionFetcher.submit(
            { intent: "lookup-word", vietnameseWord: translation },
            { method: "post" }
        );
    };

    const toggleSelectLookupWord = (index: number) => {
        setSelectedLookupWords(prev => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                newSet.add(index);
            }
            return newSet;
        });
    };

    const selectAllLookupWords = () => {
        if (selectedLookupWords.size === lookupResults.length) {
            setSelectedLookupWords(new Set());
        } else {
            setSelectedLookupWords(new Set(lookupResults.map((_, i) => i)));
        }
    };

    const handleAddSelectedWords = () => {
        if (selectedLookupWords.size === 0) {
            toast.error("Vui lòng chọn ít nhất 1 từ.");
            return;
        }

        const wordsToAdd = Array.from(selectedLookupWords).map(i => lookupResults[i]);
        actionFetcher.submit(
            { intent: "add-words", words: JSON.stringify(wordsToAdd), targetTopicId: lookupTargetTopic },
            { method: "post" }
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
            {/* Header */}
            <div className="bg-gradient-to-r from-primary to-indigo-600 text-white py-12">
                <div className="container mx-auto px-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-black mb-2">📖 Từ điển LinguaFast</h1>
                            <p className="text-white/80 font-medium">
                                {initialData.totalCount} từ vựng trong kho từ điển
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Link
                                to="/dictionary/quiz"
                                className="px-6 py-3 rounded-xl font-bold transition-all bg-amber-500 text-white hover:bg-amber-600 flex items-center gap-2"
                            >
                                📝 Kiểm tra
                            </Link>
                            <button
                                onClick={() => setShowLookup(!showLookup)}
                                className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${showLookup
                                    ? "bg-white/20 text-white border-2 border-white/30"
                                    : "bg-white text-primary hover:bg-white/90"
                                    }`}
                            >
                                ✨ Thêm từ mới
                            </button>
                        </div>
                    </div>

                    {/* Search bar */}
                    <form onSubmit={handleSearch} className="mt-6 max-w-xl">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Tìm kiếm từ vựng..."
                                className="flex-1 px-5 py-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-white placeholder:text-white/50 font-medium focus:outline-none focus:border-white/50 transition-all"
                            />
                            <button
                                type="submit"
                                className="px-5 py-3 bg-white text-primary font-bold rounded-xl hover:bg-white/90 transition-all"
                            >
                                🔍
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Lookup Panel */}
            {showLookup && (
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 py-8 animate-fadeIn">
                    <div className="container mx-auto px-4">
                        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                            <div className="p-6 border-b border-gray-100">
                                <h2 className="text-xl font-black text-gray-900 mb-2">🔍 Tra cứu từ tiếng Anh</h2>
                                <p className="text-gray-500 text-sm">Nhập từ tiếng Việt để tìm các từ tiếng Anh tương ứng</p>

                                <form onSubmit={handleLookup} className="mt-4 flex gap-3">
                                    <input
                                        type="text"
                                        value={vietnameseInput}
                                        onChange={(e) => setVietnameseInput(e.target.value)}
                                        placeholder="Nhập từ tiếng Việt (VD: hạnh phúc, yêu thương...)"
                                        className="flex-1 px-5 py-3 rounded-xl border-2 border-gray-200 focus:border-primary outline-none font-medium transition-all"
                                    />
                                    <button
                                        type="submit"
                                        disabled={isLookupLoading}
                                        className="px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark transition-all disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {isLookupLoading ? (
                                            <>
                                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Đang tìm...
                                            </>
                                        ) : (
                                            <>✨ Tìm từ</>
                                        )}
                                    </button>
                                </form>
                            </div>

                            {/* Lookup Results */}
                            {lookupResults.length > 0 && (
                                <div className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={selectAllLookupWords}
                                                className="px-3 py-1.5 text-xs font-bold bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                            >
                                                {selectedLookupWords.size === lookupResults.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                                            </button>
                                            <span className="text-sm font-medium text-gray-500">
                                                Đã chọn {selectedLookupWords.size}/{lookupResults.length} từ
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <select
                                                value={lookupTargetTopic}
                                                onChange={(e) => setLookupTargetTopic(e.target.value)}
                                                className="px-4 py-2 border-2 border-gray-200 rounded-xl font-medium focus:border-primary outline-none"
                                            >
                                                <option value="">📂 Không phân loại</option>
                                                {initialData.topics.map(topic => (
                                                    <option key={topic.id} value={topic.id}>
                                                        {topic.viTitle || topic.title}
                                                    </option>
                                                ))}
                                            </select>
                                            <button
                                                onClick={handleAddSelectedWords}
                                                disabled={selectedLookupWords.size === 0 || isLookupLoading}
                                                className="px-5 py-2 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-all disabled:opacity-50"
                                            >
                                                Thêm vào từ điển
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {lookupResults.map((word, index) => {
                                            const isSelected = selectedLookupWords.has(index);
                                            return (
                                                <div
                                                    key={index}
                                                    onClick={() => toggleSelectLookupWord(index)}
                                                    className={`p-3 md:p-4 rounded-xl border-2 cursor-pointer transition-all ${isSelected
                                                        ? "border-primary bg-primary/5"
                                                        : "border-gray-100 hover:border-gray-200"
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-2 md:gap-3">
                                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? "bg-primary border-primary text-white" : "border-gray-300"}`}>
                                                            {isSelected && <span className="text-xs">✓</span>}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                                                <span className="font-black text-gray-900 text-sm md:text-base">{word.term}</span>
                                                                <span className="text-[10px] md:text-xs text-gray-400">{word.phonetic}</span>
                                                                <span className="px-1 py-0.5 bg-gray-100 text-gray-500 text-[8px] md:text-[9px] font-bold uppercase rounded">
                                                                    {word.type}
                                                                </span>
                                                            </div>
                                                            <p className="text-primary font-bold text-xs md:text-sm truncate">{word.translation}</p>
                                                        </div>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); speak(word.term); }}
                                                            className="p-1.5 md:p-2 rounded-lg text-lg md:text-xl text-gray-400 hover:bg-primary/10 hover:text-primary transition-all shrink-0"
                                                            aria-label="Phát âm"
                                                        >
                                                            🔊
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="container mx-auto px-4 py-6">
                {/* Topic Filter */}
                <div className="mb-6 flex flex-wrap gap-2">
                    <button
                        onClick={() => handleTopicChange("")}
                        className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${!selectedTopic
                            ? "bg-primary text-white shadow-lg"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                    >
                        Tất cả
                    </button>
                    <button
                        onClick={() => handleTopicChange("uncategorized")}
                        className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${selectedTopic === "uncategorized"
                            ? "bg-amber-500 text-white shadow-lg"
                            : "bg-amber-50 text-amber-600 hover:bg-amber-100"
                            }`}
                    >
                        📂 Chưa phân loại
                    </button>
                    {initialData.topics.map((topic) => (
                        <button
                            key={topic.id}
                            onClick={() => handleTopicChange(topic.id)}
                            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${selectedTopic === topic.id
                                ? "bg-primary text-white shadow-lg"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                }`}
                        >
                            {topic.viTitle || topic.title}
                        </button>
                    ))}
                </div>

                {/* Words List */}
                {words.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="text-5xl mb-4">🔍</div>
                        <h3 className="text-xl font-black text-gray-900 mb-2">Không tìm thấy từ nào</h3>
                        <p className="text-gray-500 text-sm">Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc chủ đề</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
                        {words.map((word) => {
                            const isExpanded = expandedWordId === word.id;
                            const showAddDropdown = addToTopicWordId === word.id;
                            const otherTopics = initialData.topics.filter(t => t.id !== word.topic?.id);

                            return (
                                <div key={word.id} className="transition-all">
                                    {/* Compact Row */}
                                    <div
                                        onClick={() => toggleExpand(word.id)}
                                        className={`flex items-center gap-2 md:gap-4 px-3 md:px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors ${isExpanded ? 'bg-primary/5' : ''}`}
                                    >
                                        {/* Term - English */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1 md:gap-2">
                                                <span className="font-black text-gray-900 text-base md:text-lg truncate">{word.term}</span>
                                                <span className="text-gray-400 text-xs font-medium hidden sm:inline">{word.phonetic}</span>
                                            </div>
                                        </div>

                                        {/* Translation - Vietnamese */}
                                        <div className="flex-1 min-w-0 text-right sm:text-left mr-2">
                                            <span className="font-bold text-primary text-sm md:text-base truncate block">{word.translation || "—"}</span>
                                        </div>

                                        {/* Type badge - desktop only */}
                                        <span className="hidden md:inline px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-black uppercase rounded shrink-0">
                                            {word.type}
                                        </span>

                                        {/* Action buttons group - compact on mobile */}
                                        <div className="flex items-center gap-0.5 md:gap-1 shrink-0">
                                            {/* Add to topic button */}
                                            <div className="relative">
                                                <button
                                                    onClick={(e) => toggleAddToTopic(word.id, e)}
                                                    className={`p-1.5 md:p-2 rounded-lg transition-all text-lg md:text-xl ${showAddDropdown ? 'bg-primary text-white' : 'text-gray-400 hover:bg-emerald-100 hover:text-emerald-600'}`}
                                                    title="Thêm vào chủ đề khác"
                                                    aria-label="Thêm vào chủ đề"
                                                >
                                                    📁
                                                </button>

                                                {/* Dropdown */}
                                                {showAddDropdown && (
                                                    <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 animate-fadeIn overflow-hidden">
                                                        <div className="p-3 border-b border-gray-100 bg-gray-50">
                                                            <p className="text-xs font-black text-gray-500 uppercase">Thêm "{word.term}" vào:</p>
                                                        </div>
                                                        <div className="max-h-48 overflow-y-auto">
                                                            {otherTopics.length === 0 ? (
                                                                <p className="p-4 text-sm text-gray-400 text-center">Không có chủ đề khác</p>
                                                            ) : (
                                                                otherTopics.map(topic => (
                                                                    <div key={topic.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 border-b border-gray-50 last:border-0">
                                                                        <span className="flex-1 text-sm font-medium text-gray-700 truncate">
                                                                            {topic.viTitle || topic.title}
                                                                        </span>
                                                                        <button
                                                                            onClick={(e) => handleWordAction(word.id, topic.id, 'copy', e)}
                                                                            className="px-2 py-1 text-[10px] font-bold bg-emerald-100 text-emerald-600 rounded hover:bg-emerald-200 transition-colors"
                                                                        >
                                                                            Sao chép
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => handleWordAction(word.id, topic.id, 'move', e)}
                                                                            className="px-2 py-1 text-[10px] font-bold bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition-colors"
                                                                        >
                                                                            Chuyển
                                                                        </button>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Speak button */}
                                            <button
                                                onClick={(e) => speak(word.term, e)}
                                                className="p-1.5 md:p-2 rounded-lg text-lg md:text-xl text-gray-400 hover:bg-primary/10 hover:text-primary transition-all"
                                                title="Phát âm"
                                                aria-label="Phát âm"
                                            >
                                                🔊
                                            </button>

                                            {/* Expand indicator */}
                                            <span className={`text-gray-300 text-base md:text-lg transition-transform px-1 ${isExpanded ? 'rotate-180' : ''}`}>
                                                ▼
                                            </span>
                                        </div>
                                    </div>

                                    {/* Expanded Detail */}
                                    {isExpanded && (
                                        <div className="px-5 pb-5 pt-2 bg-gradient-to-b from-primary/5 to-white animate-fadeIn">
                                            <div className="grid md:grid-cols-2 gap-6">
                                                {/* Left column */}
                                                <div>
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <h3 className="text-2xl font-black text-gray-900">{word.term}</h3>
                                                        <span className="px-2 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase rounded-lg">
                                                            {word.type}
                                                        </span>
                                                    </div>
                                                    {word.phonetic && (
                                                        <p className="text-gray-400 font-medium mb-3">{word.phonetic}</p>
                                                    )}
                                                    <div className="text-xl font-black text-primary mb-2">
                                                        {word.translation || "—"}
                                                    </div>
                                                    <p className="text-gray-500 text-sm italic">
                                                        {word.viDefinition || word.definition}
                                                    </p>
                                                </div>

                                                {/* Right column */}
                                                <div>
                                                    <div className="bg-gray-50 rounded-xl p-4 mb-3">
                                                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Ví dụ</div>
                                                        <p className="text-gray-700 font-medium mb-1">"{word.example}"</p>
                                                        {word.viExample && (
                                                            <p className="text-gray-400 text-sm italic">→ {word.viExample}</p>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center justify-between">
                                                        {word.topic?.slug ? (
                                                            <Link
                                                                to={`/learn/${word.topic.slug}`}
                                                                className="inline-flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-primary transition-colors"
                                                            >
                                                                📚 {word.topic?.viTitle || word.topic?.title}
                                                                <span>→</span>
                                                            </Link>
                                                        ) : (
                                                            <span className="text-xs font-bold text-gray-300">📂 Chưa phân loại</span>
                                                        )}

                                                        {word.translation && (
                                                            <button
                                                                onClick={(e) => findSimilarWords(word.translation!, e)}
                                                                className="px-3 py-1.5 bg-emerald-100 text-emerald-600 text-xs font-bold rounded-lg hover:bg-emerald-200 transition-colors flex items-center gap-1"
                                                            >
                                                                ✨ Tìm từ tương tự
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Load more trigger */}
                <div ref={loadMoreRef} className="py-8 flex justify-center">
                    {isLoading && (
                        <div className="flex items-center gap-3 text-primary font-bold text-sm">
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Đang tải thêm...
                        </div>
                    )}
                    {!hasMore && words.length > 0 && (
                        <p className="text-gray-400 font-medium text-sm">✨ Đã hiển thị tất cả {words.length} từ</p>
                    )}
                </div>
            </div>

            {/* Overlay to close dropdown when clicking outside */}
            {addToTopicWordId && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setAddToTopicWordId(null)}
                />
            )}
        </div>
    );
}
