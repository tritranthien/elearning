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

export async function loader({ request }: Route.LoaderArgs) {
    const userId = await requireUserId(request);

    // Get recent conversations for the user
    let conversations: any[] = [];
    try {
        // @ts-ignore - Model may not exist until prisma generate is run
        if (prisma.conversation) {
            conversations = await (prisma as any).conversation.findMany({
                where: { userId },
                include: {
                    phrases: true
                },
                orderBy: { createdAt: "desc" },
                take: 20
            });
        }
    } catch (e) {
        console.log("[Practice] Conversation model not available yet. Run 'npx prisma db push'");
    }

    return { conversations, userId };
}

export async function action({ request }: Route.ActionArgs) {
    const userId = await requireUserId(request);
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "translate") {
        const vietnameseText = formData.get("vietnameseText") as string;

        if (!vietnameseText?.trim()) {
            return { error: "Vui lòng nói hoặc nhập nội dung." };
        }

        try {
            const result = await translateAndAnalyze(vietnameseText.trim());

            // Save conversation to database (if model exists)
            let conversationId = null;
            try {
                // @ts-ignore
                if ((prisma as any).conversation) {
                    const conversation = await (prisma as any).conversation.create({
                        data: {
                            userId,
                            vietnameseText: vietnameseText.trim(),
                            englishText: result.englishText,
                            phrases: {
                                create: result.phrases.map((p: any) => ({
                                    english: p.english,
                                    vietnamese: p.vietnamese,
                                    phonetic: p.phonetic,
                                    partOfSpeech: p.partOfSpeech,
                                    example: p.example,
                                    viExample: p.viExample
                                }))
                            }
                        },
                        include: { phrases: true }
                    });
                    conversationId = conversation.id;
                }
            } catch (e) {
                console.log("[Practice] Could not save conversation - run 'npx prisma db push'");
            }

            // Auto-save all phrases to dictionary (skip duplicates)
            const savedWords: string[] = [];
            const skippedWords: string[] = [];

            for (const phrase of result.phrases) {
                try {
                    // Check if word already exists (case-insensitive)
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
                        savedWords.push(phrase.english);
                        console.log(`[Practice] Saved word: ${phrase.english}`);
                    } else {
                        skippedWords.push(phrase.english);
                        console.log(`[Practice] Skipped duplicate: ${phrase.english}`);
                    }
                } catch (e) {
                    console.log(`[Practice] Error saving word ${phrase.english}:`, e);
                }
            }

            return {
                success: true,
                intent: "translate",
                englishText: result.englishText,
                phrases: result.phrases,
                conversationId,
                savedWords,
                skippedWords
            };
        } catch (error: any) {
            return { error: error.message || "Lỗi khi dịch.", intent: "translate" };
        }
    }

    if (intent === "save-to-dictionary") {
        const phraseJson = formData.get("phrase") as string;

        if (!phraseJson) {
            return { error: "Thiếu thông tin từ vựng." };
        }

        try {
            const phrase = JSON.parse(phraseJson);

            // Check if word already exists
            const existing = await prisma.word.findFirst({
                where: { term: { equals: phrase.english, mode: "insensitive" } }
            });

            if (existing) {
                return { error: `Từ "${phrase.english}" đã tồn tại trong từ điển.`, intent: "save-to-dictionary" };
            }

            // Add to dictionary (uncategorized)
            await prisma.word.create({
                data: {
                    term: phrase.english,
                    phonetic: phrase.phonetic,
                    type: phrase.partOfSpeech,
                    definition: phrase.example || phrase.english,
                    viDefinition: phrase.vietnamese,
                    translation: phrase.vietnamese,
                    example: phrase.example || `I use "${phrase.english}" in daily conversation.`,
                    viExample: phrase.viExample
                } as any
            });

            return { success: true, intent: "save-to-dictionary", word: phrase.english };
        } catch (error: any) {
            return { error: error.message || "Lỗi khi lưu từ.", intent: "save-to-dictionary" };
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
                recognitionRef.current.lang = "vi-VN"; // Vietnamese

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
    const { conversations } = useLoaderData<typeof loader>();
    const fetcher = useFetcher<typeof action>();

    const { isListening, transcript, isSupported, startListening, stopListening, setTranscript } = useSpeechRecognition();

    const [inputText, setInputText] = useState("");
    const [currentResult, setCurrentResult] = useState<{
        englishText: string;
        phrases: any[];
    } | null>(null);
    const [savedPhrases, setSavedPhrases] = useState<Set<string>>(new Set());

    const isLoading = fetcher.state !== "idle";

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

                // Mark saved words
                if (data.savedWords?.length > 0) {
                    setSavedPhrases(prev => new Set([...prev, ...data.savedWords]));
                }
                if (data.skippedWords?.length > 0) {
                    setSavedPhrases(prev => new Set([...prev, ...data.skippedWords]));
                }

                // Auto-speak the English translation
                speakEnglish(data.englishText);

                // Show detailed toast
                const saved = data.savedWords?.length || 0;
                const skipped = data.skippedWords?.length || 0;
                if (saved > 0 && skipped > 0) {
                    toast.success(`Đã dịch! Lưu ${saved} từ mới, bỏ qua ${skipped} từ đã có.`);
                } else if (saved > 0) {
                    toast.success(`Đã dịch và lưu ${saved} từ mới vào từ điển!`);
                } else if (skipped > 0) {
                    toast.success(`Đã dịch! ${skipped} từ đã có trong từ điển.`);
                } else {
                    toast.success("Đã dịch thành công!");
                }
            } else if (fetcher.data.intent === "save-to-dictionary" && fetcher.data.success) {
                const word = (fetcher.data as any).word;
                if (word) {
                    setSavedPhrases(prev => new Set([...prev, word]));
                    toast.success(`Đã lưu "${word}" vào từ điển!`);
                }
            }
        }
    }, [fetcher.state, fetcher.data]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim()) return;

        fetcher.submit(
            { intent: "translate", vietnameseText: inputText },
            { method: "post" }
        );
    };

    const handleSavePhrase = (phrase: any) => {
        fetcher.submit(
            { intent: "save-to-dictionary", phrase: JSON.stringify(phrase) },
            { method: "post" }
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-12">
                <div className="container mx-auto px-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-black mb-2">🎤 Thực hành Hội thoại</h1>
                            <p className="text-white/80 font-medium">
                                Nói tiếng Việt → Học cách nói tiếng Anh
                            </p>
                        </div>
                        <Link
                            to="/"
                            className="px-6 py-3 bg-white/20 hover:bg-white/30 rounded-xl font-bold transition-all"
                        >
                            ← Trang chủ
                        </Link>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-8">
                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Main practice area */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Speech input */}
                        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                            <div className="p-6 border-b border-gray-100">
                                <h2 className="text-xl font-black text-gray-900 mb-1">Bạn muốn nói gì?</h2>
                                <p className="text-gray-500 text-sm">Nhấn nút mic để nói tiếng Việt hoặc gõ trực tiếp</p>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6">
                                <div className="flex gap-4 mb-4">
                                    {/* Microphone button */}
                                    {isSupported ? (
                                        <button
                                            type="button"
                                            onClick={isListening ? stopListening : startListening}
                                            className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl transition-all shadow-lg ${isListening
                                                ? "bg-red-500 text-white animate-pulse"
                                                : "bg-gradient-to-br from-emerald-500 to-teal-600 text-white hover:shadow-xl"
                                                }`}
                                        >
                                            {isListening ? "🔴" : "🎤"}
                                        </button>
                                    ) : (
                                        <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl bg-gray-200 text-gray-400">
                                            🎤
                                        </div>
                                    )}

                                    {/* Text input */}
                                    <div className="flex-1">
                                        <textarea
                                            value={inputText}
                                            onChange={(e) => setInputText(e.target.value)}
                                            placeholder={isListening ? "Đang nghe..." : "Hoặc gõ tiếng Việt tại đây..."}
                                            className="w-full h-20 px-4 py-3 border-2 border-gray-200 rounded-xl font-medium resize-none focus:border-emerald-500 focus:outline-none transition-all"
                                            disabled={isListening}
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={!inputText.trim() || isLoading}
                                    className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black rounded-xl hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isLoading ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Đang dịch...
                                        </>
                                    ) : (
                                        <>🔄 Dịch sang tiếng Anh</>
                                    )}
                                </button>
                            </form>
                        </div>

                        {/* Translation result */}
                        {currentResult && (
                            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden animate-fadeIn">
                                {/* English translation */}
                                <div className="p-6 bg-gradient-to-r from-indigo-500 to-purple-600">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <p className="text-white/60 text-xs font-bold uppercase tracking-wider mb-2">Tiếng Anh</p>
                                            <p className="text-2xl font-black text-white leading-relaxed">
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

                                {/* Extracted phrases */}
                                <div className="p-6">
                                    <h3 className="text-lg font-black text-gray-900 mb-4">📚 Từ vựng cần nhớ</h3>
                                    <div className="space-y-4">
                                        {currentResult.phrases.map((phrase, index) => (
                                            <div
                                                key={index}
                                                className="p-4 bg-gray-50 rounded-xl border-2 border-gray-100 hover:border-emerald-200 transition-all"
                                            >
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex items-center gap-3">
                                                        <h4 className="text-xl font-black text-gray-900">{phrase.english}</h4>
                                                        <span className="text-gray-400 font-medium">{phrase.phonetic}</span>
                                                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-xs font-bold rounded-full">
                                                            {phrase.partOfSpeech}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => speakEnglish(phrase.english)}
                                                            className="p-2 hover:bg-gray-200 rounded-lg transition-all"
                                                        >
                                                            🔊
                                                        </button>
                                                        <span className="px-3 py-1 bg-emerald-100 text-emerald-600 text-xs font-bold rounded-lg">
                                                            ✓ Đã lưu
                                                        </span>
                                                    </div>
                                                </div>
                                                <p className="text-emerald-600 font-bold mb-2">{phrase.vietnamese}</p>
                                                {phrase.example && (
                                                    <div className="mt-2 pl-3 border-l-2 border-gray-200">
                                                        <p className="text-gray-600 text-sm italic">"{phrase.example}"</p>
                                                        {phrase.viExample && (
                                                            <p className="text-gray-400 text-xs mt-1">→ {phrase.viExample}</p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* History sidebar */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden sticky top-4">
                            <div className="p-6 border-b border-gray-100">
                                <h2 className="text-lg font-black text-gray-900">📖 Lịch sử</h2>
                                <p className="text-gray-500 text-sm">{conversations.length} cuộc hội thoại</p>
                            </div>

                            <div className="max-h-[500px] overflow-y-auto">
                                {conversations.length === 0 ? (
                                    <div className="p-8 text-center">
                                        <div className="text-4xl mb-3">💬</div>
                                        <p className="text-gray-400 text-sm">Chưa có cuộc hội thoại nào</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-50">
                                        {conversations.map((conv) => (
                                            <button
                                                key={conv.id}
                                                onClick={() => {
                                                    setCurrentResult({
                                                        englishText: conv.englishText,
                                                        phrases: conv.phrases
                                                    });
                                                    speakEnglish(conv.englishText);
                                                }}
                                                className="w-full p-4 text-left hover:bg-gray-50 transition-all"
                                            >
                                                <p className="text-gray-600 font-medium text-sm truncate mb-1">
                                                    🇻🇳 {conv.vietnameseText}
                                                </p>
                                                <p className="text-gray-900 font-bold truncate">
                                                    🇺🇸 {conv.englishText}
                                                </p>
                                                <p className="text-gray-400 text-xs mt-1">
                                                    {conv.phrases.length} từ/cụm
                                                </p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
