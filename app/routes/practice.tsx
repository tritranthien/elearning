import { useState, useEffect, useRef } from "react";
import { Link, useLoaderData, useFetcher } from "react-router";
import type { Route } from "./+types/practice";
import { prisma } from "../utils/db.server";
import { requireUserId } from "../utils/session.server";
import { translateAndAnalyze } from "../utils/ai.server";
import { toast } from "sonner";

export function meta({ }: Route.MetaArgs) {
    return [{ title: "Thực hành Hội thoại - LinguaFast" }];
}

// Default colors for new topics
const TOPIC_COLORS = [
    "from-emerald-500 to-teal-600",
    "from-blue-500 to-indigo-600",
    "from-purple-500 to-pink-600",
    "from-orange-500 to-red-600",
    "from-cyan-500 to-blue-600",
    "from-rose-500 to-pink-600",
];

// Default icons for topics
const TOPIC_ICONS = ["💬", "🛒", "🍽️", "✈️", "🏥", "💼", "🎓", "🏠", "🎉", "📞"];

export async function loader({ request }: Route.LoaderArgs) {
    const userId = await requireUserId(request);

    // Get all conversation topics for the user with conversations and their phrases
    let topics: any[] = [];
    try {
        topics = await prisma.conversationTopic.findMany({
            where: { userId },
            include: {
                conversations: {
                    orderBy: { createdAt: "desc" },
                    include: {
                        phrases: true // Include phrases for each conversation
                    }
                },
                phrases: {
                    orderBy: { createdAt: "desc" }
                }
            },
            orderBy: { updatedAt: "desc" }
        });
    } catch (e) {
        console.log("[Practice] ConversationTopic model not available yet. Run 'npx prisma db push'");
    }

    // Get all vocabulary topics for moving phrases
    let vocabularyTopics: any[] = [];
    try {
        vocabularyTopics = await prisma.topic.findMany({
            orderBy: { title: "asc" }
        });
    } catch (e) {
        console.log("[Practice] Topic model error");
    }

    return { topics, vocabularyTopics, userId };
}

export async function action({ request }: Route.ActionArgs) {
    const userId = await requireUserId(request);
    const formData = await request.formData();
    const intent = formData.get("intent");

    // Create new topic
    if (intent === "create-topic") {
        const title = formData.get("title") as string;
        const description = formData.get("description") as string;
        const icon = formData.get("icon") as string || "💬";

        if (!title?.trim()) {
            return { error: "Vui lòng nhập tên chủ đề.", intent };
        }

        try {
            const randomColor = TOPIC_COLORS[Math.floor(Math.random() * TOPIC_COLORS.length)];
            const topic = await prisma.conversationTopic.create({
                data: {
                    userId,
                    title: title.trim(),
                    description: description?.trim() || null,
                    icon,
                    color: randomColor
                }
            });
            return { success: true, intent, topic };
        } catch (error: any) {
            return { error: error.message || "Lỗi khi tạo chủ đề.", intent };
        }
    }

    // Delete topic
    if (intent === "delete-topic") {
        const topicId = formData.get("topicId") as string;

        if (!topicId) {
            return { error: "Thiếu ID chủ đề.", intent };
        }

        try {
            await prisma.conversationTopic.delete({
                where: { id: topicId }
            });
            return { success: true, intent, deletedTopicId: topicId };
        } catch (error: any) {
            return { error: error.message || "Lỗi khi xóa chủ đề.", intent };
        }
    }

    // Translate and save to topic
    if (intent === "translate") {
        const vietnameseText = formData.get("vietnameseText") as string;
        const topicId = formData.get("topicId") as string;

        if (!vietnameseText?.trim()) {
            return { error: "Vui lòng nói hoặc nhập nội dung.", intent };
        }

        if (!topicId) {
            return { error: "Vui lòng chọn một chủ đề.", intent };
        }

        try {
            const result = await translateAndAnalyze(vietnameseText.trim());

            // Save conversation to topic first
            const conversation = await prisma.conversation.create({
                data: {
                    userId,
                    topicId,
                    vietnameseText: vietnameseText.trim(),
                    englishText: result.englishText
                }
            });

            // Save phrases linked to this conversation (skip duplicates within conversation)
            const savedPhrases: string[] = [];
            const skippedPhrases: string[] = [];
            const savedPhrasesList: any[] = [];

            for (const phrase of result.phrases) {
                try {
                    // Check if phrase already exists in this conversation
                    const existing = await prisma.phrase.findUnique({
                        where: {
                            conversationId_english: {
                                conversationId: conversation.id,
                                english: phrase.english
                            }
                        }
                    });

                    if (!existing) {
                        const savedPhrase = await prisma.phrase.create({
                            data: {
                                topicId,
                                conversationId: conversation.id,
                                english: phrase.english,
                                vietnamese: phrase.vietnamese,
                                phonetic: phrase.phonetic,
                                partOfSpeech: phrase.partOfSpeech,
                                example: phrase.example,
                                viExample: phrase.viExample
                            }
                        });
                        savedPhrases.push(phrase.english);
                        savedPhrasesList.push(savedPhrase);
                    } else {
                        skippedPhrases.push(phrase.english);
                    }
                } catch (e) {
                    console.log(`[Practice] Error saving phrase ${phrase.english}:`, e);
                }
            }

            // Update topic's updatedAt
            await prisma.conversationTopic.update({
                where: { id: topicId },
                data: { updatedAt: new Date() }
            });

            // Also auto-save to dictionary
            for (const phrase of result.phrases) {
                try {
                    const existing = await prisma.word.findFirst({
                        where: { term: { equals: phrase.english, mode: "insensitive" } }
                    });

                    if (!existing) {
                        await prisma.word.create({
                            data: {
                                term: phrase.english,
                                phonetic: phrase.phonetic,
                                type: phrase.partOfSpeech,
                                definition: phrase.example || phrase.english,
                                viDefinition: phrase.vietnamese,
                                translation: phrase.vietnamese,
                                example: phrase.example || `Example: "${phrase.english}"`,
                                viExample: phrase.viExample
                            } as any
                        });
                    }
                } catch (e) {
                    console.log(`[Practice] Error saving to dictionary:`, e);
                }
            }

            return {
                success: true,
                intent,
                englishText: result.englishText,
                phrases: result.phrases,
                conversationId: conversation.id,
                savedPhrases,
                skippedPhrases
            };
        } catch (error: any) {
            return { error: error.message || "Lỗi khi dịch.", intent };
        }
    }

    // Toggle phrase ignored status
    if (intent === "toggle-phrase-ignore") {
        const phraseId = formData.get("phraseId") as string;

        try {
            const phrase = await prisma.phrase.findUnique({ where: { id: phraseId } });
            if (phrase) {
                await prisma.phrase.update({
                    where: { id: phraseId },
                    data: { isIgnored: !phrase.isIgnored }
                });
            }
            return { success: true, intent };
        } catch (error: any) {
            return { error: error.message, intent };
        }
    }

    // Move phrase to vocabulary topic
    if (intent === "move-to-topic") {
        const phraseId = formData.get("phraseId") as string;
        const targetTopicId = formData.get("targetTopicId") as string;

        if (!phraseId || !targetTopicId) {
            return { error: "Thiếu thông tin.", intent };
        }

        try {
            const phrase = await prisma.phrase.findUnique({ where: { id: phraseId } });
            if (!phrase) {
                return { error: "Không tìm thấy từ vựng.", intent };
            }

            // Check if word already exists in dictionary
            const existing = await prisma.word.findFirst({
                where: { term: { equals: phrase.english, mode: "insensitive" } }
            });

            if (existing) {
                // Update existing word to add to topic
                await prisma.word.update({
                    where: { id: existing.id },
                    data: { topicId: targetTopicId }
                });
                return {
                    success: true,
                    intent,
                    word: phrase.english,
                    message: `Đã chuyển "${phrase.english}" vào bộ từ vựng!`
                };
            } else {
                // Create new word in topic
                await prisma.word.create({
                    data: {
                        term: phrase.english,
                        phonetic: phrase.phonetic,
                        type: phrase.partOfSpeech,
                        definition: phrase.example || phrase.english,
                        viDefinition: phrase.vietnamese,
                        translation: phrase.vietnamese,
                        example: phrase.example || `Example: "${phrase.english}"`,
                        viExample: phrase.viExample,
                        topicId: targetTopicId
                    }
                });
                return {
                    success: true,
                    intent,
                    word: phrase.english,
                    message: `Đã thêm "${phrase.english}" vào bộ từ vựng!`
                };
            }
        } catch (error: any) {
            return { error: error.message || "Lỗi khi chuyển từ.", intent };
        }
    }

    return { error: "Hành động không hợp lệ." };
}

// Speech recognition hook
function useSpeechRecognition() {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [isSupported, setIsSupported] = useState(false);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                setIsSupported(true);
                recognitionRef.current = new SpeechRecognition();
                recognitionRef.current.continuous = false;
                recognitionRef.current.interimResults = true;
                recognitionRef.current.lang = "vi-VN";

                recognitionRef.current.onresult = (event: any) => {
                    let finalTranscript = "";
                    for (let i = event.resultIndex; i < event.results.length; i++) {
                        const transcript = event.results[i][0].transcript;
                        if (event.results[i].isFinal) {
                            finalTranscript += transcript;
                        }
                    }
                    if (finalTranscript) {
                        setTranscript(finalTranscript);
                    }
                };

                recognitionRef.current.onend = () => {
                    setIsListening(false);
                };

                recognitionRef.current.onerror = (event: any) => {
                    console.error("Speech recognition error:", event.error);
                    setIsListening(false);
                };
            }
        }
    }, []);

    const startListening = () => {
        if (recognitionRef.current) {
            setTranscript("");
            recognitionRef.current.start();
            setIsListening(true);
        }
    };

    const stopListening = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            setIsListening(false);
        }
    };

    return { isListening, transcript, isSupported, startListening, stopListening, setTranscript };
}

export default function Practice() {
    const { topics, vocabularyTopics } = useLoaderData<typeof loader>();
    const fetcher = useFetcher<typeof action>();

    const { isListening, transcript, isSupported, startListening, stopListening, setTranscript } = useSpeechRecognition();

    const [inputText, setInputText] = useState("");
    const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [showNewTopicModal, setShowNewTopicModal] = useState(false);
    const [newTopicTitle, setNewTopicTitle] = useState("");
    const [newTopicDescription, setNewTopicDescription] = useState("");
    const [newTopicIcon, setNewTopicIcon] = useState("💬");
    const [currentResult, setCurrentResult] = useState<{
        englishText: string;
        phrases: any[];
    } | null>(null);
    const [showIgnored, setShowIgnored] = useState(false);
    // State for moving phrase to vocabulary topic
    const [movePhrase, setMovePhrase] = useState<any | null>(null);
    const [selectedVocabTopicId, setSelectedVocabTopicId] = useState<string>("");
    // Search and filter state
    const [searchQuery, setSearchQuery] = useState("");
    // Pagination state for conversations and phrases
    const [conversationsPage, setConversationsPage] = useState(1);
    const [phrasesPage, setPhrasesPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    const isLoading = fetcher.state !== "idle";

    // Filter topics based on search query
    const filteredTopics = topics.filter((topic: any) => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase().trim();
        return topic.title.toLowerCase().includes(query) ||
            (topic.description && topic.description.toLowerCase().includes(query));
    });

    const selectedTopic = topics.find((t: any) => t.id === selectedTopicId);
    const selectedConversation = selectedTopic?.conversations.find((c: any) => c.id === selectedConversationId);

    // Get phrases to display - either from selected conversation or all from topic
    const allDisplayPhrases = selectedConversation
        ? selectedConversation.phrases
        : selectedTopic?.phrases || [];

    // Paginated conversations
    const allConversations = selectedTopic?.conversations || [];
    const paginatedConversations = allConversations.slice(0, conversationsPage * ITEMS_PER_PAGE);
    const hasMoreConversations = paginatedConversations.length < allConversations.length;

    // Paginated phrases (after filtering by ignored status)
    const filteredPhrases = allDisplayPhrases.filter((p: any) => showIgnored || !p.isIgnored);
    const paginatedPhrases = filteredPhrases.slice(0, phrasesPage * ITEMS_PER_PAGE);
    const hasMorePhrases = paginatedPhrases.length < filteredPhrases.length;

    // Reset pagination when topic or conversation changes
    useEffect(() => {
        setConversationsPage(1);
        setPhrasesPage(1);
    }, [selectedTopicId, selectedConversationId]);

    // Text-to-speech for English
    const speakEnglish = (text: string) => {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-US";
        utterance.rate = 0.85;
        window.speechSynthesis.speak(utterance);
    };

    // Update input when transcript changes
    useEffect(() => {
        if (transcript) {
            setInputText(transcript);
        }
    }, [transcript]);

    // Handle fetcher results
    useEffect(() => {
        if (fetcher.state === "idle" && fetcher.data) {
            if (fetcher.data.error) {
                toast.error(fetcher.data.error);
            } else if (fetcher.data.intent === "translate" && fetcher.data.success) {
                const data = fetcher.data as any;
                setCurrentResult({
                    englishText: data.englishText,
                    phrases: data.phrases
                });
                speakEnglish(data.englishText);
                setInputText("");
                // Select the newly created conversation
                if (data.conversationId) {
                    setSelectedConversationId(data.conversationId);
                }

                const saved = data.savedPhrases?.length || 0;
                const skipped = data.skippedPhrases?.length || 0;
                if (saved > 0 && skipped > 0) {
                    toast.success(`Đã dịch! Lưu ${saved} từ mới, bỏ qua ${skipped} từ đã có.`);
                } else if (saved > 0) {
                    toast.success(`Đã dịch và lưu ${saved} từ mới!`);
                } else if (skipped > 0) {
                    toast.success(`Đã dịch! ${skipped} từ đã có trong câu này.`);
                } else {
                    toast.success("Đã dịch thành công!");
                }
            } else if (fetcher.data.intent === "create-topic" && fetcher.data.success) {
                const topic = (fetcher.data as any).topic;
                if (topic) {
                    setSelectedTopicId(topic.id);
                    setSelectedConversationId(null);
                    toast.success(`Đã tạo chủ đề "${topic.title}"!`);
                }
                setShowNewTopicModal(false);
                setNewTopicTitle("");
                setNewTopicDescription("");
                setNewTopicIcon("💬");
            } else if (fetcher.data.intent === "delete-topic" && fetcher.data.success) {
                const deletedId = (fetcher.data as any).deletedTopicId;
                if (selectedTopicId === deletedId) {
                    setSelectedTopicId(null);
                    setSelectedConversationId(null);
                    setCurrentResult(null);
                }
                toast.success("Đã xóa chủ đề!");
            } else if (fetcher.data.intent === "move-to-topic" && fetcher.data.success) {
                const message = (fetcher.data as any).message;
                toast.success(message || "Đã chuyển từ vựng!");
                setMovePhrase(null);
                setSelectedVocabTopicId("");
            }
        }
    }, [fetcher.state, fetcher.data]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim() || !selectedTopicId) return;

        fetcher.submit(
            { intent: "translate", vietnameseText: inputText, topicId: selectedTopicId },
            { method: "post" }
        );
    };

    const handleCreateTopic = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTopicTitle.trim()) return;

        fetcher.submit(
            { intent: "create-topic", title: newTopicTitle, description: newTopicDescription, icon: newTopicIcon },
            { method: "post" }
        );
    };

    const handleDeleteTopic = (topicId: string) => {
        if (confirm("Bạn có chắc muốn xóa chủ đề này? Tất cả hội thoại và từ vựng trong đó sẽ bị xóa.")) {
            fetcher.submit(
                { intent: "delete-topic", topicId },
                { method: "post" }
            );
        }
    };

    const handleSelectConversation = (conv: any) => {
        if (selectedConversationId === conv.id) {
            setSelectedConversationId(null);
            setCurrentResult(null);
        } else {
            setSelectedConversationId(conv.id);
            setCurrentResult({
                englishText: conv.englishText,
                phrases: conv.phrases
            });
            speakEnglish(conv.englishText);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
            {/* Header - Mobile optimized */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-6 md:py-12">
                <div className="container mx-auto px-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <h1 className="text-xl sm:text-2xl md:text-4xl font-black mb-1 md:mb-2 break-words">🎤 Hội thoại</h1>
                            <p className="text-white/80 font-medium text-xs sm:text-sm md:text-base break-words">
                                Nói tiếng Việt → Học tiếng Anh
                            </p>
                        </div>
                        <Link
                            to="/"
                            className="hidden sm:flex px-4 md:px-6 py-2 md:py-3 bg-white/20 hover:bg-white/30 rounded-xl font-bold transition-all text-sm md:text-base whitespace-nowrap"
                        >
                            ← Trang chủ
                        </Link>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-3 sm:px-4 py-4 md:py-8">
                {/* Mobile Topics Horizontal Scroll */}
                <div className="lg:hidden mb-4">
                    <div className="flex items-center gap-2 mb-3">
                        <h2 className="text-sm font-black text-white">📁 Chủ đề</h2>
                        <button
                            onClick={() => setShowNewTopicModal(true)}
                            className="p-1.5 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-white text-xs transition-all"
                        >
                            ➕
                        </button>
                    </div>
                    {/* Mobile Search */}
                    <div className="relative mb-3">
                        <input
                            type="text"
                            placeholder="Tìm chủ đề..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-8 py-2 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 text-sm focus:outline-none focus:bg-white/20 transition-all"
                        />
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                            >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                    {/* Wrap with overflow-hidden to contain negative margins */}
                    <div className="overflow-hidden">
                        <div className="flex gap-2 overflow-x-auto pb-2 -mx-3 px-3 scrollbar-hide">
                            {filteredTopics.length === 0 ? (
                                <div className="flex-shrink-0 px-4 py-2 bg-white/10 text-white rounded-xl text-sm font-medium">
                                    {searchQuery ? "Không tìm thấy kết quả" : "+ Tạo chủ đề đầu tiên"}
                                </div>
                            ) : (
                                filteredTopics.map((topic: any) => (
                                    <button
                                        key={topic.id}
                                        onClick={() => {
                                            setSelectedTopicId(topic.id);
                                            setSelectedConversationId(null);
                                            setCurrentResult(null);
                                        }}
                                        className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-all ${selectedTopicId === topic.id
                                            ? "bg-white text-emerald-600 shadow-lg"
                                            : "bg-white/10 text-white hover:bg-white/20"
                                            }`}
                                    >
                                        <span>{topic.icon || "💬"}</span>
                                        <span className="whitespace-nowrap">{topic.title}</span>
                                        <span className="text-xs opacity-60">{topic.conversations.length}</span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid lg:grid-cols-4 gap-4 md:gap-8 overflow-hidden">
                    {/* Topics sidebar - Hidden on mobile, shown on lg+ */}
                    <div className="hidden lg:block lg:col-span-1">
                        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden sticky top-4">
                            <div className="p-6 border-b border-gray-100">
                                <div className="flex items-center justify-between mb-2">
                                    <h2 className="text-lg font-black text-gray-900">📁 Chủ đề</h2>
                                    <button
                                        onClick={() => setShowNewTopicModal(true)}
                                        className="p-2 bg-emerald-100 hover:bg-emerald-200 rounded-lg text-emerald-600 transition-all"
                                        title="Tạo chủ đề mới"
                                    >
                                        ➕
                                    </button>
                                </div>
                                <p className="text-gray-500 text-sm mb-3">{topics.length} chủ đề</p>

                                {/* Desktop Search */}
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Tìm kiếm..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                    />
                                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    {searchQuery && (
                                        <button
                                            onClick={() => setSearchQuery("")}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                                {searchQuery && (
                                    <p className="text-xs text-gray-500 mt-2">
                                        Tìm thấy <span className="font-bold text-emerald-600">{filteredTopics.length}</span> kết quả
                                    </p>
                                )}
                            </div>

                            <div className="max-h-[400px] overflow-y-auto">
                                {filteredTopics.length === 0 ? (
                                    <div className="p-8 text-center">
                                        <div className="text-4xl mb-3">{searchQuery ? "🔍" : "📂"}</div>
                                        <p className="text-gray-400 text-sm mb-4">
                                            {searchQuery ? "Không tìm thấy chủ đề phù hợp" : "Chưa có chủ đề nào"}
                                        </p>
                                        {!searchQuery && (
                                            <button
                                                onClick={() => setShowNewTopicModal(true)}
                                                className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-bold hover:bg-emerald-600 transition-all"
                                            >
                                                Tạo chủ đề đầu tiên
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-50">
                                        {filteredTopics.map((topic: any) => (
                                            <div
                                                key={topic.id}
                                                className={`p-4 cursor-pointer transition-all ${selectedTopicId === topic.id
                                                    ? "bg-emerald-50 border-l-4 border-emerald-500"
                                                    : "hover:bg-gray-50"
                                                    }`}
                                            >
                                                <div
                                                    onClick={() => {
                                                        setSelectedTopicId(topic.id);
                                                        setSelectedConversationId(null);
                                                        setCurrentResult(null);
                                                    }}
                                                    className="flex-1"
                                                >
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-xl">{topic.icon || "💬"}</span>
                                                        <h3 className="font-bold text-gray-900 truncate">{topic.title}</h3>
                                                    </div>
                                                    <p className="text-gray-400 text-xs">
                                                        {topic.conversations.length} câu · {topic.phrases.length} từ/cụm
                                                    </p>
                                                </div>
                                                {selectedTopicId === topic.id && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteTopic(topic.id);
                                                        }}
                                                        className="mt-2 text-xs text-red-500 hover:text-red-700"
                                                    >
                                                        🗑️ Xóa
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Main practice area */}
                    <div className="lg:col-span-3 space-y-4 md:space-y-6 min-w-0 overflow-hidden">
                        {!selectedTopicId ? (
                            <div className="bg-white rounded-2xl md:rounded-3xl shadow-2xl p-6 md:p-12 text-center overflow-hidden">
                                <div className="text-6xl mb-4">👈</div>
                                <h2 className="text-2xl font-black text-gray-900 mb-2">Chọn một chủ đề</h2>
                                <p className="text-gray-500 mb-6">
                                    Chọn hoặc tạo một chủ đề hội thoại để bắt đầu thực hành
                                </p>
                                <button
                                    onClick={() => setShowNewTopicModal(true)}
                                    className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold rounded-xl hover:shadow-lg transition-all"
                                >
                                    ➕ Tạo chủ đề mới
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Current topic info */}
                                <div className={`bg-gradient-to-r ${selectedTopic?.color || 'from-emerald-500 to-teal-600'} rounded-2xl md:rounded-3xl p-4 md:p-6 text-white overflow-hidden`}>
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-2xl md:text-3xl">{selectedTopic?.icon || "💬"}</span>
                                        <h2 className="text-lg md:text-2xl font-black break-words">{selectedTopic?.title}</h2>
                                    </div>
                                    {selectedTopic?.description && (
                                        <p className="text-white/80 text-sm md:text-base break-words">{selectedTopic.description}</p>
                                    )}
                                    <div className="flex flex-wrap gap-2 mt-3 md:mt-4 text-xs md:text-sm">
                                        <span className="bg-white/20 px-2 md:px-3 py-1 rounded-full">
                                            {selectedTopic?.conversations.length || 0} câu
                                        </span>
                                        <span className="bg-white/20 px-2 md:px-3 py-1 rounded-full">
                                            {selectedTopic?.phrases.length || 0} từ
                                        </span>
                                        {selectedConversationId && (
                                            <button
                                                onClick={() => {
                                                    setSelectedConversationId(null);
                                                    setCurrentResult(null);
                                                }}
                                                className="bg-white/30 hover:bg-white/40 px-2 md:px-3 py-1 rounded-full transition-all"
                                            >
                                                ✕ Bỏ chọn
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Speech input - Mobile optimized */}
                                <div className="bg-white rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden">
                                    <div className="p-4 md:p-6 border-b border-gray-100">
                                        <h2 className="text-base md:text-xl font-black text-gray-900 mb-0.5 md:mb-1">Bạn muốn nói gì?</h2>
                                        <p className="text-gray-500 text-xs md:text-sm">Nhấn mic để nói hoặc gõ trực tiếp</p>
                                    </div>

                                    <form onSubmit={handleSubmit} className="p-4 md:p-6">
                                        <div className="flex gap-3 md:gap-4 mb-4">
                                            {isSupported ? (
                                                <button
                                                    type="button"
                                                    onClick={isListening ? stopListening : startListening}
                                                    className={`w-16 h-16 md:w-20 md:h-20 flex-shrink-0 rounded-full flex items-center justify-center text-3xl md:text-4xl transition-all shadow-lg touch-target ${isListening
                                                        ? "bg-red-500 text-white animate-pulse"
                                                        : "bg-gradient-to-br from-emerald-500 to-teal-600 text-white hover:shadow-xl active:scale-95"
                                                        }`}
                                                >
                                                    {isListening ? "🔴" : "🎤"}
                                                </button>
                                            ) : (
                                                <div className="w-16 h-16 md:w-20 md:h-20 flex-shrink-0 rounded-full flex items-center justify-center text-3xl md:text-4xl bg-gray-200 text-gray-400">
                                                    🎤
                                                </div>
                                            )}

                                            <div className="flex-1 min-w-0">
                                                <textarea
                                                    value={inputText}
                                                    onChange={(e) => setInputText(e.target.value)}
                                                    placeholder={isListening ? "Đang nghe..." : "Gõ tiếng Việt..."}
                                                    className="w-full h-16 md:h-20 px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base border-2 border-gray-200 rounded-xl font-medium resize-none focus:border-emerald-500 focus:outline-none transition-all"
                                                    disabled={isListening}
                                                />
                                            </div>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={!inputText.trim() || isLoading}
                                            className="w-full py-3 md:py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black text-sm md:text-base rounded-xl hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 touch-target"
                                        >
                                            {isLoading ? (
                                                <>
                                                    <svg className="animate-spin h-4 w-4 md:h-5 md:w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Đang dịch...
                                                </>
                                            ) : (
                                                <>🔄 Dịch</>
                                            )}
                                        </button>
                                    </form>
                                </div>

                                {/* Translation result - Mobile optimized */}
                                {currentResult && (
                                    <div className="bg-white rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden animate-slideUp">
                                        <div className="p-4 md:p-6 bg-gradient-to-r from-indigo-500 to-purple-600">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-white/60 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-1 md:mb-2">Tiếng Anh</p>
                                                    <p className="text-lg md:text-2xl font-black text-white leading-relaxed break-words">
                                                        {currentResult.englishText}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => speakEnglish(currentResult.englishText)}
                                                    className="p-4 bg-white/20 hover:bg-white/30 rounded-xl transition-all text-2xl"
                                                >
                                                    🔊
                                                </button>
                                            </div>
                                        </div>

                                        <div className="p-6">
                                            <h3 className="text-lg font-black text-gray-900 mb-4">
                                                📚 Từ vựng {selectedConversationId ? "của câu này" : "đã lưu"}
                                                <span className="text-gray-400 font-normal text-sm ml-2">
                                                    ({currentResult.phrases.length} từ/cụm)
                                                </span>
                                            </h3>
                                            <div className="space-y-3 md:space-y-4">
                                                {currentResult.phrases.map((phrase, index) => (
                                                    <div
                                                        key={index}
                                                        className="p-3 md:p-4 bg-gray-50 rounded-xl border-2 border-gray-100"
                                                    >
                                                        <div className="flex items-start justify-between gap-2 mb-2">
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex flex-wrap items-center gap-1 md:gap-2 mb-1">
                                                                    <h4 className="text-base md:text-xl font-black text-gray-900 break-words">{phrase.english}</h4>
                                                                    <span className="px-1.5 md:px-2 py-0.5 bg-indigo-100 text-indigo-600 text-[10px] md:text-xs font-bold rounded-full shrink-0">
                                                                        {phrase.partOfSpeech}
                                                                    </span>
                                                                </div>
                                                                <span className="text-gray-400 font-medium text-xs md:text-sm">{phrase.phonetic}</span>
                                                            </div>
                                                            <button
                                                                onClick={() => speakEnglish(phrase.english)}
                                                                className="p-1.5 md:p-2 hover:bg-gray-200 rounded-lg transition-all shrink-0 touch-target"
                                                            >
                                                                🔊
                                                            </button>
                                                        </div>
                                                        <p className="text-emerald-600 font-bold text-sm md:text-base mb-2">{phrase.vietnamese}</p>
                                                        {phrase.example && (
                                                            <div className="mt-2 pl-2 md:pl-3 border-l-2 border-gray-200">
                                                                <p className="text-gray-600 text-xs md:text-sm italic break-words">"{phrase.example}"</p>
                                                                {phrase.viExample && (
                                                                    <p className="text-gray-400 text-[10px] md:text-xs mt-1 break-words">→ {phrase.viExample}</p>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Topic's conversation history & phrases - Mobile stack, desktop grid */}
                                {selectedTopic && (allConversations.length > 0 || selectedTopic.phrases.length > 0) && (
                                    <>
                                        {/* Desktop layout - 2 columns */}
                                        <div className="hidden md:grid md:grid-cols-2 gap-6">
                                            {/* Conversations */}
                                            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                                                <div className="p-6 border-b border-gray-100">
                                                    <h3 className="text-lg font-black text-gray-900">💬 Lịch sử</h3>
                                                    <p className="text-gray-500 text-sm">
                                                        {allConversations.length} câu
                                                        {allConversations.length > ITEMS_PER_PAGE && ` • Hiển ${paginatedConversations.length}/${allConversations.length}`}
                                                        {selectedConversationId && " • Click để xem từ vựng"}
                                                    </p>
                                                </div>
                                                <div className="max-h-[400px] overflow-y-auto">
                                                    <div className="divide-y divide-gray-50">
                                                        {paginatedConversations.map((conv: any) => (
                                                            <button
                                                                key={conv.id}
                                                                onClick={() => handleSelectConversation(conv)}
                                                                className={`w-full p-4 text-left transition-all active:bg-gray-100 ${selectedConversationId === conv.id
                                                                    ? "bg-indigo-50 border-l-4 border-indigo-500"
                                                                    : "hover:bg-gray-50"
                                                                    }`}
                                                            >
                                                                <p className="text-gray-600 font-medium text-sm break-words mb-1">
                                                                    🇻🇳 {conv.vietnameseText}
                                                                </p>
                                                                <p className="text-gray-900 font-bold text-base break-words">
                                                                    🇺🇸 {conv.englishText}
                                                                </p>
                                                                <p className="text-gray-400 text-xs mt-1">
                                                                    {conv.phrases?.length || 0} từ
                                                                </p>
                                                            </button>
                                                        ))}
                                                    </div>
                                                    {hasMoreConversations && (
                                                        <div className="p-3 border-t border-gray-100">
                                                            <button
                                                                onClick={() => setConversationsPage(prev => prev + 1)}
                                                                className="w-full py-2 text-sm font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                            >
                                                                Tải thêm {Math.min(ITEMS_PER_PAGE, allConversations.length - paginatedConversations.length)} câu nữa...
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Phrases display - Desktop */}
                                            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                                                <div className="p-6 border-b border-gray-100">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <h3 className="text-lg font-black text-gray-900 truncate">
                                                                📚 {selectedConversationId ? "Từ vựng câu" : "Tất cả từ vựng"}
                                                            </h3>
                                                            <p className="text-gray-500 text-sm">
                                                                {allDisplayPhrases.filter((p: any) => !p.isIgnored).length} từ
                                                                {filteredPhrases.length > ITEMS_PER_PAGE && ` • Hiển ${paginatedPhrases.length}/${filteredPhrases.length}`}
                                                            </p>
                                                        </div>
                                                        <label className="flex items-center gap-2 text-sm shrink-0">
                                                            <input
                                                                type="checkbox"
                                                                checked={showIgnored}
                                                                onChange={(e) => setShowIgnored(e.target.checked)}
                                                                className="rounded w-4 h-4"
                                                            />
                                                            <span className="text-gray-500">Hiện đã ẩn</span>
                                                        </label>
                                                    </div>
                                                </div>
                                                <div className="max-h-[400px] overflow-y-auto">
                                                    {allDisplayPhrases.length === 0 ? (
                                                        <div className="p-8 text-center">
                                                            <div className="text-4xl mb-3">📝</div>
                                                            <p className="text-gray-400 text-sm">
                                                                {selectedConversationId
                                                                    ? "Chưa có từ vựng"
                                                                    : "Chưa có từ vựng nào"
                                                                }
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="divide-y divide-gray-50">
                                                                {paginatedPhrases.map((phrase: any) => (
                                                                    <div
                                                                        key={phrase.id}
                                                                        className={`p-4 ${phrase.isIgnored ? 'opacity-50' : ''}`}
                                                                    >
                                                                        <div className="flex items-start justify-between gap-2">
                                                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                                                <button
                                                                                    onClick={() => speakEnglish(phrase.english)}
                                                                                    className="text-lg hover:scale-110 transition-transform shrink-0"
                                                                                >
                                                                                    🔊
                                                                                </button>
                                                                                <div className="min-w-0">
                                                                                    <span className="font-bold text-gray-900">{phrase.english}</span>
                                                                                    <span className="text-gray-400 text-sm ml-1">{phrase.phonetic}</span>
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex items-center gap-2 shrink-0">
                                                                                <button
                                                                                    onClick={() => setMovePhrase(phrase)}
                                                                                    className="text-xs px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-all"
                                                                                    title="Lưu"
                                                                                >
                                                                                    📥 Lưu
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => {
                                                                                        fetcher.submit(
                                                                                            { intent: "toggle-phrase-ignore", phraseId: phrase.id },
                                                                                            { method: "post" }
                                                                                        );
                                                                                    }}
                                                                                    className="text-xs text-gray-400 hover:text-gray-600 px-1"
                                                                                >
                                                                                    {phrase.isIgnored ? "👁️" : "🙈"}
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                        <p className="text-emerald-600 text-sm mt-1 pl-8">{phrase.vietnamese}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            {hasMorePhrases && (
                                                                <div className="p-3 border-t border-gray-100">
                                                                    <button
                                                                        onClick={() => setPhrasesPage(prev => prev + 1)}
                                                                        className="w-full py-2 text-sm font-bold text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                                                    >
                                                                        Tải thêm {Math.min(ITEMS_PER_PAGE, filteredPhrases.length - paginatedPhrases.length)} từ nữa...
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Mobile layout - Accordion style */}
                                        <div className="md:hidden bg-white rounded-2xl shadow-2xl overflow-hidden">
                                            <div className="p-4 border-b border-gray-100">
                                                <h3 className="text-base font-black text-gray-900">💬 Lịch sử hội thoại</h3>
                                                <p className="text-gray-500 text-xs">
                                                    {allConversations.length} câu • Nhấn để xem từ vựng
                                                </p>
                                            </div>
                                            <div className="max-h-[60vh] overflow-y-auto">
                                                <div className="divide-y divide-gray-100">
                                                    {paginatedConversations.map((conv: any) => (
                                                        <div key={conv.id}>
                                                            {/* Conversation header - clickable */}
                                                            <button
                                                                onClick={() => handleSelectConversation(conv)}
                                                                className={`w-full p-3 text-left transition-all ${selectedConversationId === conv.id
                                                                    ? "bg-indigo-50 border-l-4 border-indigo-500"
                                                                    : "hover:bg-gray-50 active:bg-gray-100"
                                                                    }`}
                                                            >
                                                                <div className="flex items-start justify-between gap-2">
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="text-gray-600 font-medium text-xs mb-1 break-words">
                                                                            🇻🇳 {conv.vietnameseText}
                                                                        </p>
                                                                        <p className="text-gray-900 font-bold text-sm break-words">
                                                                            🇺🇸 {conv.englishText}
                                                                        </p>
                                                                    </div>
                                                                    <div className="flex items-center gap-1 shrink-0 mt-1">
                                                                        <span className="text-[10px] text-gray-400">{conv.phrases?.length || 0} từ</span>
                                                                        <span className={`text-gray-400 transition-transform text-xs ${selectedConversationId === conv.id ? "rotate-180" : ""}`}>
                                                                            ▼
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </button>

                                                            {/* Inline vocabulary - shown when selected */}
                                                            {selectedConversationId === conv.id && conv.phrases && conv.phrases.length > 0 && (
                                                                <div className="bg-emerald-50/50 border-l-4 border-emerald-400">
                                                                    <div className="p-2 bg-emerald-100/50 flex items-center justify-between">
                                                                        <span className="text-xs font-bold text-emerald-700">📚 Từ vựng ({conv.phrases.length})</span>
                                                                        <label className="flex items-center gap-1 text-[10px]">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={showIgnored}
                                                                                onChange={(e) => setShowIgnored(e.target.checked)}
                                                                                className="rounded w-3 h-3"
                                                                            />
                                                                            <span className="text-emerald-600">Hiện ẩn</span>
                                                                        </label>
                                                                    </div>
                                                                    <div className="divide-y divide-emerald-100/50">
                                                                        {conv.phrases
                                                                            .filter((p: any) => showIgnored || !p.isIgnored)
                                                                            .slice(0, phrasesPage * ITEMS_PER_PAGE)
                                                                            .map((phrase: any) => (
                                                                                <div
                                                                                    key={phrase.id}
                                                                                    className={`p-2.5 ${phrase.isIgnored ? 'opacity-50' : ''}`}
                                                                                >
                                                                                    <div className="flex items-start justify-between gap-2">
                                                                                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                                                            <button
                                                                                                onClick={() => speakEnglish(phrase.english)}
                                                                                                className="text-sm hover:scale-110 transition-transform shrink-0 touch-target"
                                                                                            >
                                                                                                🔊
                                                                                            </button>
                                                                                            <div className="min-w-0">
                                                                                                <span className="font-bold text-gray-900 text-sm">{phrase.english}</span>
                                                                                                <span className="text-gray-400 text-xs ml-1">{phrase.phonetic}</span>
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="flex items-center gap-1 shrink-0">
                                                                                            <button
                                                                                                onClick={() => setMovePhrase(phrase)}
                                                                                                className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded transition-all"
                                                                                            >
                                                                                                📥
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={() => {
                                                                                                    fetcher.submit(
                                                                                                        { intent: "toggle-phrase-ignore", phraseId: phrase.id },
                                                                                                        { method: "post" }
                                                                                                    );
                                                                                                }}
                                                                                                className="text-[10px] text-gray-400 hover:text-gray-600 px-1"
                                                                                            >
                                                                                                {phrase.isIgnored ? "👁️" : "🙈"}
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>
                                                                                    <p className="text-emerald-600 text-xs mt-0.5 pl-5">{phrase.vietnamese}</p>
                                                                                </div>
                                                                            ))}
                                                                    </div>
                                                                    {conv.phrases.filter((p: any) => showIgnored || !p.isIgnored).length > phrasesPage * ITEMS_PER_PAGE && (
                                                                        <div className="p-2 border-t border-emerald-100">
                                                                            <button
                                                                                onClick={() => setPhrasesPage(prev => prev + 1)}
                                                                                className="w-full py-1.5 text-xs font-bold text-emerald-600 hover:bg-emerald-100 rounded transition-all"
                                                                            >
                                                                                Xem thêm từ...
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                                {hasMoreConversations && (
                                                    <div className="p-3 border-t border-gray-100">
                                                        <button
                                                            onClick={() => setConversationsPage(prev => prev + 1)}
                                                            className="w-full py-2 text-sm font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                        >
                                                            Tải thêm {Math.min(ITEMS_PER_PAGE, allConversations.length - paginatedConversations.length)} câu nữa...
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* New topic modal - Mobile optimized */}
            {showNewTopicModal && (
                <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
                    <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md overflow-hidden max-h-[90vh] overflow-y-auto animate-slideUp">
                        <div className="p-4 md:p-6 border-b border-gray-100 sticky top-0 bg-white">
                            <h2 className="text-lg md:text-xl font-black text-gray-900">➕ Tạo chủ đề mới</h2>
                            <p className="text-gray-500 text-xs md:text-sm">Tạo chủ đề để lưu trữ các câu liên quan</p>
                        </div>

                        <form onSubmit={handleCreateTopic} className="p-4 md:p-6 space-y-4">
                            <div>
                                <label className="block text-xs md:text-sm font-bold text-gray-700 mb-2">Icon</label>
                                <div className="flex flex-wrap gap-1.5 md:gap-2">
                                    {TOPIC_ICONS.map((icon) => (
                                        <button
                                            key={icon}
                                            type="button"
                                            onClick={() => setNewTopicIcon(icon)}
                                            className={`w-9 h-9 md:w-10 md:h-10 text-lg md:text-xl rounded-lg flex items-center justify-center transition-all active:scale-95 ${newTopicIcon === icon
                                                ? "bg-emerald-100 ring-2 ring-emerald-500"
                                                : "bg-gray-100 hover:bg-gray-200"
                                                }`}
                                        >
                                            {icon}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs md:text-sm font-bold text-gray-700 mb-2">Tên chủ đề *</label>
                                <input
                                    type="text"
                                    value={newTopicTitle}
                                    onChange={(e) => setNewTopicTitle(e.target.value)}
                                    placeholder="VD: Đi mua sắm, Ở nhà hàng..."
                                    className="w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs md:text-sm font-bold text-gray-700 mb-2">Mô tả (tùy chọn)</label>
                                <textarea
                                    value={newTopicDescription}
                                    onChange={(e) => setNewTopicDescription(e.target.value)}
                                    placeholder="Mô tả ngắn..."
                                    className="w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none resize-none h-16 md:h-20"
                                />
                            </div>

                            <div className="flex gap-3 pt-2 md:pt-4 safe-bottom">
                                <button
                                    type="button"
                                    onClick={() => setShowNewTopicModal(false)}
                                    className="flex-1 py-2.5 md:py-3 border-2 border-gray-200 text-gray-700 font-bold text-sm md:text-base rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-all"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={!newTopicTitle.trim() || isLoading}
                                    className="flex-1 py-2.5 md:py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-sm md:text-base rounded-xl hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-50"
                                >
                                    {isLoading ? "Đang tạo..." : "Tạo"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Move to topic modal - Mobile optimized */}
            {movePhrase && (
                <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
                    <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md overflow-hidden max-h-[85vh] overflow-y-auto animate-slideUp">
                        <div className="p-4 md:p-6 border-b border-gray-100 sticky top-0 bg-white">
                            <h2 className="text-lg md:text-xl font-black text-gray-900">📥 Lưu vào bộ từ vựng</h2>
                            <p className="text-gray-500 text-xs md:text-sm break-words">Lưu "{movePhrase.english}"</p>
                        </div>

                        <div className="p-4 md:p-6 space-y-4">
                            {/* Word info */}
                            <div className="p-3 md:p-4 bg-gray-50 rounded-xl">
                                <div className="flex items-center gap-2 mb-1 md:mb-2">
                                    <span className="text-base md:text-xl font-black text-gray-900">{movePhrase.english}</span>
                                    <span className="text-gray-400 text-xs md:text-sm">{movePhrase.phonetic}</span>
                                </div>
                                <p className="text-emerald-600 font-medium text-sm md:text-base">{movePhrase.vietnamese}</p>
                            </div>

                            {/* Topic selector */}
                            <div>
                                <label className="block text-xs md:text-sm font-bold text-gray-700 mb-2">Chọn bộ từ vựng *</label>
                                {vocabularyTopics.length === 0 ? (
                                    <div className="p-3 md:p-4 bg-yellow-50 rounded-xl text-center">
                                        <p className="text-yellow-700 text-xs md:text-sm">Chưa có bộ từ vựng nào.</p>
                                        <Link
                                            to="/topic-new"
                                            className="inline-block mt-2 px-3 md:px-4 py-2 bg-yellow-500 text-white rounded-lg font-bold text-sm hover:bg-yellow-600 active:scale-95 transition-all"
                                        >
                                            Tạo mới
                                        </Link>
                                    </div>
                                ) : (
                                    <select
                                        value={selectedVocabTopicId}
                                        onChange={(e) => setSelectedVocabTopicId(e.target.value)}
                                        className="w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none bg-white"
                                    >
                                        <option value="">-- Chọn bộ từ vựng --</option>
                                        {vocabularyTopics.map((topic: any) => (
                                            <option key={topic.id} value={topic.id}>
                                                {topic.title} {topic.viTitle ? `(${topic.viTitle})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            <div className="flex gap-3 pt-2 md:pt-4 safe-bottom">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMovePhrase(null);
                                        setSelectedVocabTopicId("");
                                    }}
                                    className="flex-1 py-2.5 md:py-3 border-2 border-gray-200 text-gray-700 font-bold text-sm md:text-base rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-all"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="button"
                                    disabled={!selectedVocabTopicId || isLoading}
                                    onClick={() => {
                                        fetcher.submit(
                                            {
                                                intent: "move-to-topic",
                                                phraseId: movePhrase.id,
                                                targetTopicId: selectedVocabTopicId
                                            },
                                            { method: "post" }
                                        );
                                    }}
                                    className="flex-1 py-2.5 md:py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold text-sm md:text-base rounded-xl hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-50"
                                >
                                    {isLoading ? "Đang lưu..." : "Lưu"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
