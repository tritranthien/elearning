import { useState } from "react";
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
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const navItems = [
        { to: "/topics", label: "Bộ từ vựng", icon: "📚" },
        { to: "/dictionary", label: "Từ điển", icon: "📖" },
        { to: "/practice", label: "Hội thoại", icon: "🎤" },
    ];

    return (
        <>
            <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur-md">
                <div className="container mx-auto flex h-[60px] md:h-[70px] items-center justify-between px-4">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-1.5 text-xl md:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-primary to-accent">
                        <span className="text-2xl md:text-3xl">⚡</span>
                        <span className="hidden xs:inline">LinguaFast</span>
                        <span className="xs:hidden">LF</span>
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-8">
                        <div className="flex gap-6">
                            {navItems.map((item) => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    className={({ isActive }) =>
                                        `text-[0.95rem] font-bold transition-colors hover:text-primary ${isActive ? "text-primary" : "text-gray-500"}`
                                    }
                                >
                                    {item.label}
                                </NavLink>
                            ))}
                        </div>

                        <div className="flex gap-4 items-center">
                            {user ? (
                                <div className="flex items-center gap-4">
                                    <div className="hidden lg:block text-right">
                                        <div className="text-sm font-black text-gray-900">{user.firstName} {user.lastName}</div>
                                        <div className="text-xs text-gray-500">{user.email}</div>
                                    </div>
                                    <Form action="/logout" method="post">
                                        <button type="submit" className="px-5 py-2 rounded-xl border border-gray-200 text-gray-700 font-bold hover:bg-gray-50 transition-colors">
                                            Đăng xuất
                                        </button>
                                    </Form>
                                </div>
                            ) : (
                                <>
                                    <Link to="/login" className="px-5 py-2 rounded-xl border border-gray-200 text-gray-700 font-bold hover:border-primary hover:text-primary transition-colors">
                                        Đăng nhập
                                    </Link>
                                    <Link to="/register" className="px-5 py-2 rounded-xl bg-primary text-white font-bold shadow-sm hover:bg-primary-dark hover:-translate-y-px hover:shadow-glow transition-all">
                                        Học ngay
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="flex items-center gap-3 md:hidden">
                        {user && (
                            <div className="text-right">
                                <div className="text-xs font-bold text-gray-900">{user.firstName}</div>
                            </div>
                        )}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                            aria-label="Menu"
                        >
                            {mobileMenuOpen ? (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            ) : (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
            </nav>

            {/* Mobile Menu Overlay */}
            {mobileMenuOpen && (
                <div className="fixed inset-0 z-40 md:hidden">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/50"
                        onClick={() => setMobileMenuOpen(false)}
                    />

                    {/* Menu */}
                    <div className="absolute top-[60px] left-0 right-0 bg-white border-b border-gray-200 shadow-xl animate-fadeIn">
                        <div className="p-4 space-y-2">
                            {navItems.map((item) => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={({ isActive }) =>
                                        `flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${isActive
                                            ? "bg-primary/10 text-primary"
                                            : "text-gray-700 hover:bg-gray-100"
                                        }`
                                    }
                                >
                                    <span className="text-xl">{item.icon}</span>
                                    {item.label}
                                </NavLink>
                            ))}

                            <div className="pt-4 mt-4 border-t border-gray-100">
                                {user ? (
                                    <div className="space-y-3">
                                        <div className="px-4 py-2">
                                            <div className="font-bold text-gray-900">{user.firstName} {user.lastName}</div>
                                            <div className="text-sm text-gray-500">{user.email}</div>
                                        </div>
                                        <Form action="/logout" method="post">
                                            <button
                                                type="submit"
                                                onClick={() => setMobileMenuOpen(false)}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 text-gray-700 font-bold hover:bg-gray-50 transition-colors"
                                            >
                                                Đăng xuất
                                            </button>
                                        </Form>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <Link
                                            to="/login"
                                            onClick={() => setMobileMenuOpen(false)}
                                            className="block w-full px-4 py-3 rounded-xl border-2 border-gray-200 text-center text-gray-700 font-bold hover:border-primary hover:text-primary transition-colors"
                                        >
                                            Đăng nhập
                                        </Link>
                                        <Link
                                            to="/register"
                                            onClick={() => setMobileMenuOpen(false)}
                                            className="block w-full px-4 py-3 rounded-xl bg-primary text-center text-white font-bold shadow-sm hover:bg-primary-dark transition-all"
                                        >
                                            Học ngay
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
