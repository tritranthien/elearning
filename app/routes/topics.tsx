import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/topics";
import { prisma } from "../utils/db.server";

export function meta({ }: Route.MetaArgs) {
    return [{ title: "Vocabulary Packs - LinguaFast" }];
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
        title: topic.title,
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
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Vocabulary Packs</h1>
                    <p className="text-gray-500">Choose a topic to start expanding your lexicon.</p>
                </div>

                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button className="px-4 py-2 text-sm font-medium rounded-md bg-white shadow-sm text-gray-900">All Packs</button>
                    <button className="px-4 py-2 text-sm font-medium rounded-md text-gray-500 hover:text-gray-900">My Packs</button>
                    <button className="px-4 py-2 text-sm font-medium rounded-md text-gray-500 hover:text-gray-900">Completed</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {packs.map(pack => (
                    <Link key={pack.id} to={`/learn/${pack.id}`} className="group relative overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                        {/* Header Background */}
                        <div className={`h-32 bg-gradient-to-r ${pack.color} p-6 relative overflow-hidden`}>
                            <div className="absolute top-0 right-0 p-4 opacity-10 text-8xl transform translate-x-4 -translate-y-4">
                                {pack.image}
                            </div>
                            <div className="relative z-10 text-white">
                                <div className="text-xs font-bold uppercase tracking-wider opacity-80 mb-2">{pack.level}</div>
                                <div className="text-5xl">{pack.image}</div>
                            </div>
                        </div>

                        <div className="p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-primary transition-colors">{pack.title}</h3>
                            <div className="flex items-center text-sm text-gray-500 mb-4">
                                <span className="mr-4">📚 {pack.wordCount} words</span>
                                <span>⏱️ ~{Math.ceil(pack.wordCount / 10)} mins</span>
                            </div>

                            <div className="w-full bg-gray-100 rounded-full h-2 mb-4 overflow-hidden">
                                <div className="bg-primary h-full rounded-full" style={{ width: `${pack.progress}%` }}></div>
                            </div>

                            <div className="flex justify-between items-center">
                                <span className="text-xs font-medium text-gray-400">{pack.progress > 0 ? `${pack.progress}% mastered` : 'Not started'}</span>
                                <button className="px-4 py-2 bg-gray-50 hover:bg-primary hover:text-white text-gray-700 text-sm font-semibold rounded-lg transition-colors">
                                    Start
                                </button>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
