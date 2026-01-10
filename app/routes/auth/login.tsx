import { Link, Form, useActionData } from "react-router";
import type { Route } from "./+types/login";
import bcrypt from "bcryptjs";
import { prisma } from "../../utils/db.server";
import { createUserSession } from "../../utils/session.server";

export function meta({ }: Route.MetaArgs) {
    return [{ title: "Login - LinguaFast" }];
}

export async function action({ request }: Route.ActionArgs) {
    const formData = await request.formData();
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
        return { error: "Email and password are required" };
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        return { error: "Invalid email or password" };
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
        return { error: "Invalid email or password" };
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
                    <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
                    <p className="text-gray-500 mt-1">Enter your details to access your account</p>
                </div>

                {actionData?.error && (
                    <div className="mb-4 p-3 bg-red-50 text-red-500 text-sm rounded-lg border border-red-100 text-center font-medium">
                        {actionData.error}
                    </div>
                )}

                <Form method="post" className="flex flex-col gap-4">
                    <div>
                        <label className="block font-medium text-gray-700 mb-2 text-sm">Email</label>
                        <input
                            type="email"
                            name="email"
                            placeholder="you@example.com"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        />
                    </div>
                    <div>
                        <label className="block font-medium text-gray-700 mb-2 text-sm">Password</label>
                        <input
                            type="password"
                            name="password"
                            placeholder="••••••••"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        />
                    </div>

                    <div className="flex justify-between text-sm items-center">
                        <label className="flex items-center gap-2 cursor-pointer text-gray-600 select-none">
                            <input type="checkbox" className="rounded border-gray-300 text-primary focus:ring-primary" />
                            Remember me
                        </label>
                        <Link to="/forgot-password" className="text-primary font-medium hover:underline">Forgot password?</Link>
                    </div>

                    <button type="submit" className="mt-2 w-full py-3 px-4 bg-primary text-white font-semibold rounded-xl shadow-sm hover:bg-primary-dark hover:shadow-lg transition-all">
                        Sign in
                    </button>
                </Form>

                <div className="mt-8 text-center text-sm text-gray-500">
                    Don't have an account? <Link to="/register" className="text-primary font-bold hover:underline">Sign up</Link>
                </div>
            </div>
        </div>
    );
}
