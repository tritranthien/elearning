import React from "react";

export function Skeleton({ className }: { className?: string }) {
    return (
        <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`}></div>
    );
}

export function TopicCardSkeleton() {
    return (
        <div className="rounded-3xl bg-white border border-gray-100 shadow-sm overflow-hidden h-full">
            <Skeleton className="h-32 md:h-40 rounded-none" />
            <div className="p-6 md:p-8">
                <Skeleton className="h-8 w-3/4 mb-4" />
                <div className="flex gap-4 mb-6">
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-24 rounded-full" />
                </div>
                <div className="flex gap-2 border-t border-gray-100 pt-4">
                    <Skeleton className="h-10 flex-1 rounded-xl" />
                    <Skeleton className="h-10 flex-1 rounded-xl" />
                </div>
            </div>
        </div>
    );
}

export function TopicsSkeleton() {
    return (
        <div className="container mx-auto px-4 py-8 md:py-12">
            <div className="flex justify-between items-end mb-12">
                <div>
                    <Skeleton className="h-10 w-64 mb-2" />
                    <Skeleton className="h-6 w-96" />
                </div>
                <Skeleton className="h-12 w-80 rounded-2xl" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[...Array(6)].map((_, i) => (
                    <TopicCardSkeleton key={i} />
                ))}
            </div>
        </div>
    );
}

export function WordListItemSkeleton() {
    return (
        <div className="p-6 border-b border-gray-50 flex gap-6">
            <div className="flex-shrink-0 flex flex-col items-center gap-3">
                <Skeleton className="w-6 h-6 rounded-lg" />
                <Skeleton className="w-10 h-10 rounded-xl" />
                <Skeleton className="w-10 h-10 rounded-xl" />
            </div>
            <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                    <Skeleton className="h-8 w-40" />
                    <Skeleton className="h-5 w-12 rounded" />
                </div>
                <Skeleton className="h-4 w-24 mb-4" />
                <div className="mb-4">
                    <Skeleton className="h-7 w-48 mb-2" />
                    <Skeleton className="h-4 w-full max-w-md" />
                </div>
                <div className="rounded-xl p-3 bg-gray-50 border border-gray-100">
                    <Skeleton className="h-3 w-12 mb-2" />
                    <Skeleton className="h-4 w-full mb-1" />
                    <Skeleton className="h-4 w-2/3" />
                </div>
            </div>
        </div>
    );
}

export function LearnSkeleton() {
    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                    <Skeleton className="h-6 w-24 mx-auto mb-4 rounded-full" />
                    <Skeleton className="h-12 w-80 mx-auto mb-4" />
                    <Skeleton className="h-6 w-full max-w-2xl mx-auto" />
                </div>
                <div className="bg-white rounded-[2rem] shadow-2xl border border-gray-100 overflow-hidden">
                    <div className="p-8 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center">
                        <div>
                            <Skeleton className="h-8 w-48 mb-2" />
                            <Skeleton className="h-4 w-24" />
                        </div>
                        <Skeleton className="h-12 w-12 rounded-2xl" />
                    </div>
                    <div>
                        {[...Array(5)].map((_, i) => (
                            <WordListItemSkeleton key={i} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export function PracticeSkeleton() {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <div className="h-1 bg-slate-200"></div>
            <div className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
                <div className="flex justify-between items-center mb-8">
                    <Skeleton className="h-10 w-48" />
                    <Skeleton className="h-10 w-32 rounded-xl" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-4">
                        <Skeleton className="h-[600px] rounded-3xl" />
                    </div>
                    <div className="lg:col-span-8">
                        <Skeleton className="h-[600px] rounded-3xl" />
                    </div>
                </div>
            </div>
        </div>
    );
}

export function DictionarySkeleton() {
    return (
        <div className="min-h-screen bg-slate-50">
            <div className="bg-primary py-12">
                <div className="container mx-auto px-4">
                    <Skeleton className="h-10 w-64 mb-4 bg-white/20" />
                    <Skeleton className="h-6 w-48 mb-6 bg-white/20" />
                    <Skeleton className="h-12 w-full max-w-xl rounded-xl bg-white/20" />
                </div>
            </div>
            <div className="container mx-auto px-4 py-8">
                <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
                    {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-8 w-24 flex-shrink-0" />
                    ))}
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {[...Array(10)].map((_, i) => (
                        <div key={i} className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                            <div className="flex-1">
                                <Skeleton className="h-6 w-40 mb-2" />
                                <Skeleton className="h-4 w-24" />
                            </div>
                            <div className="flex gap-2">
                                <Skeleton className="h-10 w-10 rounded-lg" />
                                <Skeleton className="h-10 w-10 rounded-lg" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function QuizSkeleton() {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl p-8">
                <div className="flex justify-between mb-8">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-12" />
                </div>
                <div className="text-center mb-12">
                    <Skeleton className="h-8 w-64 mx-auto mb-4" />
                    <Skeleton className="h-20 w-full rounded-2xl" />
                </div>
                <div className="grid grid-cols-1 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full rounded-2xl" />
                    ))}
                </div>
            </div>
        </div>
    );
}
