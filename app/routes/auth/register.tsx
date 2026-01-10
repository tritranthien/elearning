import { Link, Form, redirect, useActionData } from "react-router";
import type { Route } from "./+types/register";
import bcrypt from "bcryptjs";
import { prisma } from "../../utils/db.server";
import { createUserSession } from "../../utils/session.server";

export function meta({ }: Route.MetaArgs) {
    return [{ title: "Đăng ký - LinguaFast" }];
}

export async function action({ request }: Route.ActionArgs) {
    const formData = await request.formData();
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;

    if (!email || !password || !firstName || !lastName) {
        return { error: "Vui lòng nhập đầy đủ thông tin" };
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        return { error: "Email này đã được sử dụng" };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
        data: {
            email,
            passwordHash,
            firstName,
            lastName,
        },
    });

    return createUserSession(user.id, "/topics");
}

export default function Register() {
    const actionData = useActionData<typeof action>();

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans">
            <div className="w-full max-w-[450px] bg-white p-10 rounded-2xl shadow-sm border border-gray-100">
                <div className="text-center mb-8">
                    <Link to="/" className="inline-flex items-center gap-2 text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-primary to-accent mb-2">
                        <span className="text-2xl">⚡</span>
                        LinguaFast
                    </Link>
                    <h1 className="text-2xl font-black text-gray-900">Bắt đầu hành trình</h1>
                    <p className="text-gray-500 mt-1 font-medium">Học tiếng Anh thật nhanh và hiệu quả</p>
                </div>

                {actionData?.error && (
                    <div className="mb-4 p-3 bg-red-50 text-red-500 text-sm rounded-lg border border-red-100 text-center font-medium">
                        {actionData.error}
                    </div>
                )}

                <Form method="post" className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block font-bold text-gray-700 mb-2 text-sm uppercase tracking-widest">Họ</label>
                            <input
                                type="text"
                                name="lastName"
                                placeholder="Nguyễn"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                            />
                        </div>
                        <div>
                            <label className="block font-bold text-gray-700 mb-2 text-sm uppercase tracking-widest">Tên</label>
                            <input
                                type="text"
                                name="firstName"
                                placeholder="Văn A"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                            />
                        </div>
                    </div>

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
                            placeholder="Tạo mật khẩu mạnh"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        />
                    </div>

                    <button type="submit" className="mt-4 w-full py-4 px-4 bg-primary text-white font-black text-lg rounded-xl shadow-lg hover:bg-primary-dark hover:-translate-y-0.5 hover:shadow-glow transition-all">
                        Tạo tài khoản
                    </button>
                </Form>

                <div className="mt-8 text-center text-sm text-gray-500 font-medium">
                    Đã có tài khoản? <Link to="/login" className="text-primary font-black hover:underline">Đăng nhập ngay</Link>
                </div>
            </div>
        </div>
    );
}
