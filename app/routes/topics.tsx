import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLoaderData, useFetcher } from "react-router";
import type { Route } from "./+types/topics";
import { prisma } from "../utils/db.server";
import { getUser } from "../utils/session.server";

const TOPICS_PER_PAGE = 9;

export function meta({ }: Route.MetaArgs) {
    return [{ title: "Bộ từ vựng - LinguaFast" }];
}

export async function loader({ request }: Route.LoaderArgs) {
    const user = await getUser(request);
    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor");
    const filterParam = url.searchParams.get("filter") || "all";

    // Build where clause based on filter
    let userProgressWhere: any = user ? { userId: user.id } : false;

    const topics = await prisma.topic.findMany({
        take: TOPICS_PER_PAGE + 1, // Take one extra to check if there are more
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { createdAt: "desc" },
        include: {
            _count: {
                select: { words: true }
            },
            userProgress: user ? {
                where: { userId: user.id }
            } : false
        }
    });

    // Check if there are more topics
    const hasMore = topics.length > TOPICS_PER_PAGE;
    const topicsToReturn = hasMore ? topics.slice(0, TOPICS_PER_PAGE) : topics;
    const nextCursor = hasMore ? topicsToReturn[topicsToReturn.length - 1].id : null;

    // Get counts for filters
    let learningCount = 0;
    let completedCount = 0;

    if (user) {
        const counts = await prisma.userTopicProgress.groupBy({
            by: ["status"],
            where: { userId: user.id, status: { not: null } },
            _count: true
        });

        counts.forEach((c: any) => {
            if (c.status === "learning") learningCount = c._count;
            if (c.status === "completed") completedCount = c._count;
        });
    }

    const totalCount = await prisma.topic.count();

    return {
        topics: topicsToReturn,
        userId: user?.id || null,
        nextCursor,
        hasMore,
        counts: {
            all: totalCount,
            learning: learningCount,
            completed: completedCount
        }
    };
}

export async function action({ request }: Route.ActionArgs) {
    const user = await getUser(request);
    if (!user) {
        return { error: "Bạn cần đăng nhập để thực hiện thao tác này" };
    }

    const formData = await request.formData();
    const intent = formData.get("intent");
    const topicId = formData.get("topicId") as string;
    const status = formData.get("status") as string | null;

    if (intent === "update-topic-status") {
        await prisma.userTopicProgress.upsert({
            where: {
                userId_topicId: { userId: user.id, topicId }
            },
            create: {
                userId: user.id,
                topicId,
                status: status || null,
                startedAt: status === "learning" ? new Date() : null,
                completedAt: status === "completed" ? new Date() : null
            },
            update: {
                status: status || null,
                startedAt: status === "learning" ? new Date() : undefined,
                completedAt: status === "completed" ? new Date() : undefined
            }
        });

        return { success: true };
    }

    return { error: "Hành động không hợp lệ" };
}

type FilterType = "all" | "learning" | "completed";

interface TopicPack {
    id: string;
    slug: string;
    title: string;
    wordCount: number;
    level: string;
    image: string;
    color: string;
    progress: number;
    status: string | null;
}

function formatTopic(topic: any): TopicPack {
    return {
        id: topic.id,
        slug: topic.slug,
        title: topic.viTitle || topic.title,
        wordCount: topic._count?.words || 0,
        level: topic.level,
        image: topic.image || "📚",
        color: topic.color || "from-gray-400 to-gray-500",
        progress: 0,
        status: topic.userProgress?.[0]?.status || null
    };
}

export default function Topics() {
    const initialData = useLoaderData<typeof loader>();
    const fetcher = useFetcher();
    const loadMoreFetcher = useFetcher<typeof loader>();

    const [filter, setFilter] = useState<FilterType>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [packs, setPacks] = useState<TopicPack[]>(() =>
        (initialData.topics || []).map(formatTopic)
    );
    const [cursor, setCursor] = useState<string | null>(initialData.nextCursor);
    const [hasMore, setHasMore] = useState(initialData.hasMore);
    const [counts, setCounts] = useState(initialData.counts);

    const loadMoreRef = useRef<HTMLDivElement>(null);
    const isLoadingMore = loadMoreFetcher.state === "loading";

    // Reset when initial data changes (e.g., after status update)
    useEffect(() => {
        setPacks((initialData.topics || []).map(formatTopic));
        setCursor(initialData.nextCursor);
        setHasMore(initialData.hasMore);
        setCounts(initialData.counts);
    }, [initialData]);

    // Handle load more data
    useEffect(() => {
        if (loadMoreFetcher.data && loadMoreFetcher.state === "idle") {
            const newTopics = (loadMoreFetcher.data.topics || []).map(formatTopic);
            setPacks(prev => [...prev, ...newTopics]);
            setCursor(loadMoreFetcher.data.nextCursor);
            setHasMore(loadMoreFetcher.data.hasMore);
        }
    }, [loadMoreFetcher.data, loadMoreFetcher.state]);

    // Intersection Observer for infinite scroll
    const loadMore = useCallback(() => {
        if (!isLoadingMore && hasMore && cursor) {
            loadMoreFetcher.load(`/topics?cursor=${cursor}&filter=${filter}`);
        }
    }, [isLoadingMore, hasMore, cursor, filter, loadMoreFetcher]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
                    loadMore();
                }
            },
            { threshold: 0.1, rootMargin: "100px" }
        );

        if (loadMoreRef.current) {
            observer.observe(loadMoreRef.current);
        }

        return () => observer.disconnect();
    }, [hasMore, isLoadingMore, loadMore]);

    // Filter packs based on selected filter AND search query
    const filteredPacks = packs.filter((pack) => {
        // First apply status filter
        let matchesFilter = true;
        if (filter === "learning") matchesFilter = pack.status === "learning";
        if (filter === "completed") matchesFilter = pack.status === "completed";

        // Then apply search filter
        let matchesSearch = true;
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            matchesSearch = pack.title.toLowerCase().includes(query);
        }

        return matchesFilter && matchesSearch;
    });

    const handleStatusChange = (topicId: string, newStatus: string | null, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!initialData.userId) {
            alert("Bạn cần đăng nhập để sử dụng tính năng này");
            return;
        }

        // Optimistic update
        setPacks(prev => prev.map(p =>
            p.id === topicId ? { ...p, status: newStatus } : p
        ));

        fetcher.submit(
            { intent: "update-topic-status", topicId, status: newStatus || "" },
            { method: "post" }
        );
    };

    if (packs.length === 0 && !isLoadingMore) {
        return (
            <div className="container mx-auto px-4 py-12 text-center">
                <h1 className="text-3xl font-black text-gray-900 mb-4">Chưa có chủ đề nào</h1>
                <p className="text-gray-500 mb-8">Hiện tại chưa có bộ từ vựng nào được tạo.</p>
                <Link to="/topics/new" className="inline-block px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-colors">
                    + Tạo chủ đề đầu tiên
                </Link>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 md:py-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 md:mb-12 gap-4 md:gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-gray-900 mb-2 break-words">Bộ từ vựng tiếng Anh</h1>
                    <p className="text-gray-500 font-medium text-sm md:text-base break-words">Chọn một chủ đề để bắt đầu mở rộng vốn từ của bạn.</p>
                </div>

                <div className="w-full md:w-auto flex flex-col sm:flex-row bg-gray-100 p-1.5 rounded-2xl shadow-inner font-bold gap-3 sm:gap-0">
                    <div className="flex overflow-x-auto pb-1 sm:pb-0 bg-white/50 backdrop-blur rounded-xl p-0.5 scrollbar-hide scroll-smooth">
                        {[
                            { id: "all" as FilterType, label: "Tất cả", count: counts.all },
                            { id: "learning" as FilterType, label: "Đang học", count: counts.learning },
                            { id: "completed" as FilterType, label: "Đã xong", count: counts.completed }
                        ].map((f) => (
                            <button
                                key={f.id}
                                onClick={() => setFilter(f.id)}
                                className={`whitespace-nowrap flex-1 sm:flex-none px-4 md:px-6 py-2 text-sm rounded-xl transition-all flex items-center gap-2 ${filter === f.id
                                    ? "bg-white shadow-sm text-gray-900"
                                    : "text-gray-500 hover:text-gray-900"
                                    }`}
                            >
                                {f.label}
                                {f.count > 0 && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${filter === f.id ? "bg-primary/10 text-primary" : "bg-gray-200 text-gray-500"
                                        }`}>
                                        {f.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                    <div className="sm:ml-4 flex items-center">
                        <Link
                            to="/topics/new"
                            className="w-full sm:w-auto text-center justify-center bg-primary text-white px-6 py-2 rounded-xl text-sm hover:bg-primary-dark transition-all shadow-glow-primary active:scale-95 flex items-center gap-2"
                        >
                            <span>+</span> Tạo chủ đề
                        </Link>
                    </div>
                </div>
            </div>

            {/* Search Box */}
            <div className="mb-6">
                <div className="relative max-w-md">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        placeholder="Tìm kiếm chủ đề..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-10 py-3 bg-white border border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
                {searchQuery && (
                    <p className="mt-2 text-sm text-gray-500">
                        Tìm thấy <span className="font-bold text-primary">{filteredPacks.length}</span> kết quả cho "{searchQuery}"
                    </p>
                )}
            </div>

            {filteredPacks.length === 0 && !isLoadingMore ? (
                <div className="text-center py-16">
                    <div className="text-6xl mb-4">
                        {filter === "learning" ? "📖" : filter === "completed" ? "🎉" : "📚"}
                    </div>
                    <h3 className="text-xl font-black text-gray-700 mb-2">
                        {filter === "learning" ? "Chưa có chủ đề nào đang học" : "Chưa hoàn thành chủ đề nào"}
                    </h3>
                    <p className="text-gray-500 mb-4">
                        {filter === "learning"
                            ? "Hãy chọn một chủ đề và đánh dấu \"Đang học\" để theo dõi tiến độ."
                            : "Hoàn thành các chủ đề và đánh dấu \"Đã xong\" để thấy ở đây."
                        }
                    </p>
                    <button
                        onClick={() => setFilter("all")}
                        className="text-primary font-bold hover:underline"
                    >
                        ← Xem tất cả chủ đề
                    </button>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                        {filteredPacks.map((pack) => (
                            <div key={pack.id} className="group relative overflow-hidden rounded-3xl bg-white border border-gray-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500">
                                {/* Status Badge */}
                                {pack.status && (
                                    <div className={`absolute top-3 right-3 z-20 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${pack.status === "learning"
                                        ? "bg-amber-400 text-amber-900"
                                        : "bg-green-400 text-green-900"
                                        }`}>
                                        {pack.status === "learning" ? "📖 Đang học" : "✅ Đã xong"}
                                    </div>
                                )}

                                <Link to={`/learn/${pack.slug}`} className="block">
                                    {/* Header Background */}
                                    <div className={`h-32 md:h-40 bg-gradient-to-br ${pack.color} p-6 md:p-8 relative overflow-hidden`}>
                                        <div className="absolute -top-4 -right-4 p-4 opacity-10 text-8xl md:text-9xl transform rotate-12 group-hover:scale-110 transition-transform duration-700">
                                            {pack.image}
                                        </div>
                                        <div className="relative z-10 text-white h-full flex flex-col justify-between">
                                            <div className="flex justify-between items-start">
                                                <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-black uppercase tracking-widest leading-none">
                                                    {pack.level === 'Beginner' ? 'Cơ bản' : pack.level === 'Intermediate' ? 'Trung cấp' : 'Nâng cao'}
                                                </span>
                                                <span className="text-2xl md:text-3xl filter drop-shadow-lg">{pack.image}</span>
                                            </div>
                                            <div className="text-xs font-bold opacity-80 flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-white opacity-60 animate-pulse"></span>
                                                {pack.wordCount} TỪ VỰNG
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-6 md:p-8">
                                        <h3 className="text-xl md:text-2xl font-black text-gray-900 mb-3 group-hover:text-primary transition-colors leading-tight break-words">{pack.title}</h3>
                                        <div className="flex items-center text-sm text-gray-500 mb-4 font-medium gap-4">
                                            <span className="flex items-center gap-1.5 bg-gray-50 px-3 py-1 rounded-full border border-gray-100 italic">
                                                <span className="text-gray-400">#</span> {pack.wordCount} từ
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                ⏱️ ~{Math.ceil(pack.wordCount / 10)} phút
                                            </span>
                                        </div>
                                    </div>
                                </Link>

                                {/* Status Toggle Buttons */}
                                <div className="px-6 md:px-8 pb-6 md:pb-8 pt-0">
                                    <div className="flex gap-2 border-t border-gray-100 pt-4">
                                        <button
                                            onClick={(e) => handleStatusChange(pack.id, pack.status === "learning" ? null : "learning", e)}
                                            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${pack.status === "learning"
                                                ? "bg-amber-100 text-amber-700 border-2 border-amber-300"
                                                : "bg-gray-50 text-gray-500 border border-gray-200 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200"
                                                }`}
                                        >
                                            📖 Đang học
                                        </button>
                                        <button
                                            onClick={(e) => handleStatusChange(pack.id, pack.status === "completed" ? null : "completed", e)}
                                            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${pack.status === "completed"
                                                ? "bg-green-100 text-green-700 border-2 border-green-300"
                                                : "bg-gray-50 text-gray-500 border border-gray-200 hover:bg-green-50 hover:text-green-600 hover:border-green-200"
                                                }`}
                                        >
                                            ✅ Đã xong
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Load More Trigger / Loading Indicator */}
                    <div ref={loadMoreRef} className="py-8 flex justify-center">
                        {isLoadingMore && (
                            <div className="flex items-center gap-3 text-gray-500">
                                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                <span className="font-medium">Đang tải thêm...</span>
                            </div>
                        )}
                        {!hasMore && packs.length > TOPICS_PER_PAGE && (
                            <div className="text-center text-gray-400 font-medium">
                                <span className="text-2xl mb-2 block">🎉</span>
                                Đã hiển thị tất cả {packs.length} chủ đề
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
