import { Link, Form, redirect, useActionData } from "react-router";
import type { Route } from "./+types/register";
import bcrypt from "bcryptjs";
import { prisma } from "../../utils/db.server";
import { createUserSession } from "../../utils/session.server";

export function meta({ }: Route.MetaArgs) {
    return [{ title: "Sign Up - LinguaFast" }];
}

export async function action({ request }: Route.ActionArgs) {
    const formData = await request.formData();
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;

    if (!email || !password || !firstName || !lastName) {
        return { error: "All fields are required" };
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        return { error: "User already exists with this email" };
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
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="w-full max-w-[450px] bg-white p-10 rounded-2xl shadow-sm border border-gray-100">
                <div className="text-center mb-8">
                    <Link to="/" className="inline-flex items-center gap-2 text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-primary to-accent mb-2">
                        <span className="text-2xl">⚡</span>
                        LinguaFast
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-900">Create an account</h1>
                    <p className="text-gray-500 mt-1">Start your English learning journey today</p>
                </div>

                {actionData?.error && (
                    <div className="mb-4 p-3 bg-red-50 text-red-500 text-sm rounded-lg border border-red-100 text-center font-medium">
                        {actionData.error}
                    </div>
                )}

                <Form method="post" className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block font-medium text-gray-700 mb-2 text-sm">First Name</label>
                            <input
                                type="text"
                                name="firstName"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                        </div>
                        <div>
                            <label className="block font-medium text-gray-700 mb-2 text-sm">Last Name</label>
                            <input
                                type="text"
                                name="lastName"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                        </div>
                    </div>

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
                            placeholder="Create a strong password"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        />
                    </div>

                    <button type="submit" className="mt-4 w-full py-3 px-4 bg-primary text-white font-semibold rounded-xl shadow-sm hover:bg-primary-dark hover:shadow-lg transition-all">
                        Create Account
                    </button>
                </Form>

                <div className="mt-8 text-center text-sm text-gray-500">
                    Already have an account? <Link to="/login" className="text-primary font-bold hover:underline">Sign in</Link>
                </div>
            </div>
        </div>
    );
}
