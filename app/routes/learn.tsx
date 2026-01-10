import { useState } from "react";
import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/learn";
import { prisma } from "../utils/db.server";
import { requireUserId } from "../utils/session.server";

export function meta({ params }: Route.MetaArgs) {
    return [{ title: `Learning ${params.topicId} - LinguaFast` }];
}

export async function loader({ params, request }: Route.LoaderArgs) {
    await requireUserId(request);

    const topic = await prisma.topic.findUnique({
        where: { slug: params.topicId },
        include: { words: true }
    });

    if (!topic) {
        throw new Response("Not Found", { status: 404 });
    }

    return { topic, words: topic.words };
}

export default function Learn() {
    const { topic, words } = useLoaderData<typeof loader>();
    const [currentCard, setCurrentCard] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);

    if (words.length === 0) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
                <h1 className="text-2xl font-bold mb-4 text-gray-900">No words in this pack yet!</h1>
                <Link to="/topics" className="px-6 py-2 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark transition-colors">
                    Go Back
                </Link>
            </div>
        );
    }

    const word = words[currentCard];
    const progress = ((currentCard + 1) / words.length) * 100;

    const handleNext = () => {
        setIsFlipped(false);
        if (currentCard < words.length - 1) {
            setTimeout(() => setCurrentCard(p => p + 1), 200);
        } else {
            alert("Pack complete! Great job.");
        }
    };

    return (
        <div className="min-h-[calc(100vh-70px)] bg-gray-50 flex flex-col">
            {/* Progress Bar */}
            <div className="w-full bg-gray-200 h-2">
                <div className="bg-primary transition-all duration-300" style={{ width: `${progress}%`, height: '100%' }}></div>
            </div>

            <div className="flex-1 container mx-auto px-4 flex flex-col items-center justify-center py-8">
                <div className="w-full max-w-2xl mb-8 flex justify-between items-center text-gray-500">
                    <Link to="/topics" className="hover:text-gray-900 transition-colors font-semibold">← Exit Practice</Link>
                    <span className="font-mono bg-white px-3 py-1 rounded-full border border-gray-100 shadow-sm">{currentCard + 1} / {words.length}</span>
                </div>

                {/* Flashcard Area */}
                <div className="relative w-full max-w-xl aspect-[4/3] perspective-1000 group cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
                    <div className={`relative w-full h-full duration-500 preserve-3d transition-transform ${isFlipped ? 'rotate-y-180' : ''}`}>

                        {/* Front */}
                        <div className="absolute w-full h-full backface-hidden bg-white rounded-3xl shadow-xl border border-gray-100 flex flex-col items-center justify-center p-8">
                            <span className="text-primary font-bold text-sm tracking-wider uppercase mb-4">{topic.title}</span>
                            <h2 className="text-5xl md:text-6xl font-extrabold text-gray-900 mb-6 text-center tracking-tight">{word.term}</h2>
                            <div className="bg-gray-100 px-6 py-2 rounded-full text-gray-600 font-mono text-xl">{word.phonetic}</div>
                            <div className="absolute bottom-10 text-gray-400 text-sm animate-pulse font-medium">Click to reveal definition</div>
                        </div>

                        {/* Back */}
                        <div className="absolute w-full h-full backface-hidden rotate-y-180 bg-white rounded-3xl shadow-xl border border-primary/20 flex flex-col items-center justify-center p-12 text-center">
                            <div className="inline-block px-4 py-1.5 bg-primary/10 text-primary text-sm font-bold uppercase rounded-lg mb-8">{word.type}</div>
                            <p className="text-2xl md:text-3xl font-semibold text-gray-800 mb-10 leading-tight">"{word.definition}"</p>
                            <div className="bg-slate-50 p-8 rounded-2xl w-full border border-slate-100">
                                <p className="text-gray-600 italic text-lg leading-relaxed">"{word.example}"</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className="mt-12 flex gap-6 w-full max-w-xl justify-center">
                    <button onClick={(e) => { e.stopPropagation(); handleNext(); }} className="flex-1 py-4 bg-white border border-gray-200 text-gray-400 font-bold rounded-2xl shadow-sm hover:bg-gray-50 transition-all">
                        Skip
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleNext(); }} className="flex-1 py-4 bg-primary text-white font-bold rounded-2xl shadow-lg hover:bg-primary-dark hover:-translate-y-1 hover:shadow-glow transition-all">
                        Mastered!
                    </button>
                </div>
            </div>
        </div>
    );
}
