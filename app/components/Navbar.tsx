import { Link, NavLink, Form } from "react-router";

interface NavbarProps {
    user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
    } | null;
}

export function Navbar({ user }: NavbarProps) {
    return (
        <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-md">
            <div className="container mx-auto flex h-[70px] items-center justify-between px-4">
                {/* Logo */}
                <Link to="/" className="flex items-center gap-2 text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-primary to-accent">
                    <span className="text-3xl">⚡</span>
                    LinguaFast
                </Link>

                {/* Navigation */}
                <div className="flex items-center gap-8">
                    <div className="hidden md:flex gap-6">
                        <NavLink to="/topics" className={({ isActive }) => `text-[0.95rem] font-medium transition-colors hover:text-primary ${isActive ? "text-primary" : "text-gray-500"}`}>
                            Word Packs
                        </NavLink>
                        <NavLink to="/review" className={({ isActive }) => `text-[0.95rem] font-medium transition-colors hover:text-primary ${isActive ? "text-primary" : "text-gray-500"}`}>
                            Review
                        </NavLink>
                        <NavLink to="/leaderboard" className={({ isActive }) => `text-[0.95rem] font-medium transition-colors hover:text-primary ${isActive ? "text-primary" : "text-gray-500"}`}>
                            Leaderboard
                        </NavLink>
                    </div>

                    <div className="flex gap-4 items-center">
                        {user ? (
                            <div className="flex items-center gap-4">
                                <div className="hidden sm:block text-right">
                                    <div className="text-sm font-bold text-gray-900">{user.firstName} {user.lastName}</div>
                                    <div className="text-xs text-gray-500">{user.email}</div>
                                </div>
                                <Form action="/logout" method="post">
                                    <button type="submit" className="px-5 py-2 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-colors">
                                        Log out
                                    </button>
                                </Form>
                            </div>
                        ) : (
                            <>
                                <Link to="/login" className="px-5 py-2 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:border-primary hover:text-primary transition-colors">
                                    Log in
                                </Link>
                                <Link to="/register" className="px-5 py-2 rounded-xl bg-primary text-white font-semibold shadow-sm hover:bg-primary-dark hover:-translate-y-px hover:shadow-glow transition-all">
                                    Start Learning
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}
