import { Suspense, useEffect, useState } from "react";
import { Outlet, useLoaderData, Await, useNavigation, useLocation } from "react-router";
import { Navbar } from "../components/Navbar";
import { getUser } from "../utils/session.server";
import type { Route } from "./+types/layout";
import { TopicsSkeleton, LearnSkeleton, PracticeSkeleton, DictionarySkeleton, QuizSkeleton } from "../components/Skeleton";

export async function loader({ request }: Route.LoaderArgs) {
    const user = await getUser(request);
    return { user };
}

function LoadingSpinner() {
    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
    );
}

export default function Layout() {
    const { user } = useLoaderData<typeof loader>();
    const navigation = useNavigation();
    const location = useLocation();
    const [skeleton, setSkeleton] = useState<React.ReactNode>(null);

    // Determine which skeleton to show based on the destination route
    useEffect(() => {
        if (navigation.state === "loading") {
            const path = navigation.location.pathname;
            if (path === "/topics") {
                setSkeleton(<TopicsSkeleton />);
            } else if (path.startsWith("/learn/")) {
                setSkeleton(<LearnSkeleton />);
            } else if (path.startsWith("/practice")) {
                setSkeleton(<PracticeSkeleton />);
            } else if (path.startsWith("/dictionary")) {
                setSkeleton(<DictionarySkeleton />);
            } else if (path.startsWith("/quiz/")) {
                setSkeleton(<QuizSkeleton />);
            } else {
                setSkeleton(<LoadingSpinner />);
            }
        } else {
            setSkeleton(null);
        }
    }, [navigation.state, navigation.location?.pathname]);

    return (
        <div className="flex flex-col min-h-screen">
            <Navbar user={user} />
            <main className="flex-1">
                {skeleton ? (
                    <div className="animate-fadeIn">
                        {skeleton}
                    </div>
                ) : (
                    <Suspense fallback={<LoadingSpinner />}>
                        <Outlet context={{ user }} />
                    </Suspense>
                )}
            </main>
            <footer className="mt-auto border-t border-gray-200 bg-gray-50 py-12">
                <div className="container mx-auto text-center text-gray-500">
                    <p>© 2025 LinguaFast. Master English with speed.</p>
                </div>
            </footer>
        </div>
    );
}
