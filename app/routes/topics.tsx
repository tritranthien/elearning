import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/topics";
import { prisma } from "../utils/db.server";

export function meta({ }: Route.MetaArgs) {
    return [{ title: "Bộ từ vựng - LinguaFast" }];
}

export async function loader({ request }: Route.LoaderArgs) {
    const topics = await prisma.topic.findMany({
        include: {
            _count: {
                select: { words: true }
            }
        }
    });

    return { topics };
}

export default function Topics() {
    const { topics } = useLoaderData<typeof loader>();

    // Format the topics to match the UI component expected data
    const packs = topics.map(topic => ({
        id: topic.slug,
        title: topic.viTitle || topic.title,
        wordCount: topic._count.words,
        level: topic.level,
        image: topic.image || "📚",
        color: topic.color || "from-gray-400 to-gray-500",
        progress: 0 // We will calculate this later based on user progress
    }));

    return (
        <div className="container mx-auto px-4 py-12">
            <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 mb-2">Bộ từ vựng tiếng Anh</h1>
                    <p className="text-gray-500 font-medium">Chọn một chủ đề để bắt đầu mở rộng vốn từ của bạn ngay hôm nay.</p>
                </div>

                <div className="flex bg-gray-100 p-1.5 rounded-2xl shadow-inner font-bold">
                    <button className="px-6 py-2 text-sm rounded-xl bg-white shadow-sm text-gray-900 transition-all">Tất cả</button>
                    <button className="px-6 py-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">Đang học</button>
                    <button className="px-6 py-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">Đã xong</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {packs.map(pack => (
                    <Link key={pack.id} to={`/learn/${pack.id}`} className="group relative overflow-hidden rounded-3xl bg-white border border-gray-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500">
                        {/* Header Background */}
                        <div className={`h-40 bg-gradient-to-br ${pack.color} p-8 relative overflow-hidden`}>
                            <div className="absolute -top-4 -right-4 p-4 opacity-10 text-9xl transform rotate-12 group-hover:scale-110 transition-transform duration-700">
                                {pack.image}
                            </div>
                            <div className="relative z-10 text-white h-full flex flex-col justify-between">
                                <div className="flex justify-between items-start">
                                    <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-black uppercase tracking-widest leading-none">
                                        {pack.level === 'Beginner' ? 'Cơ bản' : pack.level === 'Intermediate' ? 'Trung cấp' : 'Nâng cao'}
                                    </span>
                                    <span className="text-3xl filter drop-shadow-lg">{pack.image}</span>
                                </div>
                                <div className="text-xs font-bold opacity-80 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-white opacity-60 animate-pulse"></span>
                                    SẴN SÀNG HỌC
                                </div>
                            </div>
                        </div>

                        <div className="p-8">
                            <h3 className="text-2xl font-black text-gray-900 mb-3 group-hover:text-primary transition-colors leading-tight">{pack.title}</h3>
                            <div className="flex items-center text-sm text-gray-500 mb-6 font-medium gap-4">
                                <span className="flex items-center gap-1.5 bg-gray-50 px-3 py-1 rounded-full border border-gray-100 italic">
                                    <span className="text-gray-400">#</span> {pack.wordCount} từ
                                </span>
                                <span className="flex items-center gap-1.5">
                                    ⏱️ ~{Math.ceil(pack.wordCount / 10)} phút
                                </span>
                            </div>

                            <div className="space-y-3 mb-8">
                                <div className="flex justify-between items-end">
                                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Tiến độ</span>
                                    <span className="text-xs font-black text-primary">{pack.progress}%</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden shadow-inner">
                                    <div className="bg-primary h-full rounded-full transition-all duration-1000 group-hover:shadow-glow" style={{ width: `${pack.progress}%` }}></div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                                <span className="text-xs font-bold text-gray-300">BẢN DEMO</span>
                                <div className="flex items-center gap-2 text-primary font-black text-sm group-hover:translate-x-1 transition-transform">
                                    HỌC NGAY <span>→</span>
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
