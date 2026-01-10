import { Link, Form, useActionData } from "react-router";
import type { Route } from "./+types/login";
import bcrypt from "bcryptjs";
import { prisma } from "../../utils/db.server";
import { createUserSession } from "../../utils/session.server";

export function meta({ }: Route.MetaArgs) {
    return [{ title: "Đăng nhập - LinguaFast" }];
}

export async function action({ request }: Route.ActionArgs) {
    const formData = await request.formData();
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
        return { error: "Vui lòng nhập email và mật khẩu" };
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        return { error: "Email hoặc mật khẩu không chính xác" };
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
        return { error: "Email hoặc mật khẩu không chính xác" };
    }

    return createUserSession(user.id, "/topics");
}

export default function Login() {
    const actionData = useActionData<typeof action>();

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="w-full max-w-[400px] bg-white p-10 rounded-2xl shadow-sm border border-gray-100">
                <div className="text-center mb-8">
                    <Link to="/" className="inline-flex items-center gap-2 text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-primary to-accent mb-2">
                        <span className="text-2xl">⚡</span>
                        LinguaFast
                    </Link>
                    <h1 className="text-2xl font-black text-gray-900">Chào mừng trở lại</h1>
                    <p className="text-gray-500 mt-1 font-medium">Đăng nhập để vào khoá học của bạn</p>
                </div>

                {actionData?.error && (
                    <div className="mb-4 p-3 bg-red-50 text-red-500 text-sm rounded-lg border border-red-100 text-center font-medium">
                        {actionData.error}
                    </div>
                )}

                <Form method="post" className="flex flex-col gap-4">
                    <div>
                        <label className="block font-bold text-gray-700 mb-2 text-sm uppercase tracking-widest">Email</label>
                        <input
                            type="email"
                            name="email"
                            placeholder="ban@gmail.com"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                        />
                    </div>
                    <div>
                        <label className="block font-bold text-gray-700 mb-2 text-sm uppercase tracking-widest">Mật khẩu</label>
                        <input
                            type="password"
                            name="password"
                            placeholder="••••••••"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        />
                    </div>

                    <div className="flex justify-between text-sm items-center">
                        <label className="flex items-center gap-2 cursor-pointer text-gray-600 select-none font-medium">
                            <input type="checkbox" className="rounded border-gray-300 text-primary focus:ring-primary" />
                            Ghi nhớ tôi
                        </label>
                        <Link to="/forgot-password" className="text-primary font-bold hover:underline">Quên mật khẩu?</Link>
                    </div>

                    <button type="submit" className="mt-2 w-full py-4 px-4 bg-primary text-white font-black text-lg rounded-xl shadow-lg hover:bg-primary-dark hover:-translate-y-0.5 hover:shadow-glow transition-all">
                        Đăng nhập
                    </button>
                </Form>

                <div className="mt-8 text-center text-sm text-gray-500 font-medium">
                    Chưa có tài khoản? <Link to="/register" className="text-primary font-black hover:underline">Đăng ký ngay</Link>
                </div>
            </div>
        </div>
    );
}
