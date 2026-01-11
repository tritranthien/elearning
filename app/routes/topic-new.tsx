import { redirect, useActionData, Form, Link } from "react-router";
import type { Route } from "./+types/topic-new";
import { prisma } from "../utils/db.server";
import { requireUserId } from "../utils/session.server";

export function meta({ }: Route.MetaArgs) {
    return [{ title: "Tạo chủ đề mới - LinguaFast" }];
}

export async function loader({ request }: Route.LoaderArgs) {
    await requireUserId(request);
    return {};
}

export async function action({ request }: Route.ActionArgs) {
    await requireUserId(request);
    const formData = await request.formData();

    const title = formData.get("title") as string;
    const viTitle = formData.get("viTitle") as string;
    const slug = (formData.get("slug") as string || title.toLowerCase().replace(/ /g, "-").replace(/[^\w-]+/g, "")).trim();
    const description = formData.get("description") as string;
    const viDescription = formData.get("viDescription") as string;
    const level = formData.get("level") as string;
    const image = formData.get("image") as string || "📚";
    const color = formData.get("color") as string || "from-blue-500 to-cyan-500";

    if (!title || !slug || !level) {
        return { error: "Vui lòng điền đầy đủ các thông tin bắt buộc (Tiêu đề, Slug, Cấp độ)." };
    }

    try {
        const existing = await prisma.topic.findUnique({ where: { slug } });
        if (existing) {
            return { error: "Slug này đã tồn tại, vui lòng chọn slug khác." };
        }

        await prisma.topic.create({
            data: {
                title,
                viTitle,
                slug,
                description,
                viDescription,
                level,
                image,
                color
            }
        });

        return redirect("/topics");
    } catch (error: any) {
        return { error: error.message || "Đã xảy ra lỗi khi tạo chủ đề." };
    }
}

export default function TopicNew() {
    const actionData = useActionData<typeof action>();

    const gradients = [
        "from-blue-500 to-cyan-500",
        "from-purple-500 to-pink-500",
        "from-emerald-500 to-teal-500",
        "from-orange-500 to-yellow-500",
        "from-indigo-500 to-purple-500",
        "from-rose-500 to-orange-500",
        "from-slate-700 to-slate-900",
        "from-amber-400 to-orange-600"
    ];

    return (
        <div className="container mx-auto px-4 py-12 max-w-3xl">
            <div className="mb-8">
                <Link to="/topics" className="text-sm font-bold text-primary flex items-center gap-2 hover:underline mb-4">
                    ← Quay lại danh sách
                </Link>
                <h1 className="text-4xl font-black text-gray-900 italic tracking-tighter">TẠO CHỦ ĐỀ MỚI</h1>
                <p className="text-gray-500 font-medium">Thiết lập học phần mới để bắt đầu thêm từ vựng AI.</p>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden">
                <Form method="post" className="p-10 space-y-8">
                    {actionData?.error && (
                        <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl font-bold text-sm">
                            {actionData.error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* English Title */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Tiêu đề (English) *</label>
                            <input
                                name="title"
                                type="text"
                                placeholder="e.g. Daily Routine"
                                required
                                className="w-full px-6 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-primary focus:bg-white outline-none transition-all font-bold text-gray-900"
                            />
                        </div>

                        {/* Vietnamese Title */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Tiêu đề (Tiếng Việt)</label>
                            <input
                                name="viTitle"
                                type="text"
                                placeholder="e.g. Thói quen hàng ngày"
                                className="w-full px-6 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-primary focus:bg-white outline-none transition-all font-bold text-gray-900"
                            />
                        </div>
                    </div>

                    {/* Slug */}
                    <div className="space-y-2">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Slug (URL - Để trống sẽ tự tạo)</label>
                        <input
                            name="slug"
                            type="text"
                            placeholder="e.g. daily-routine"
                            className="w-full px-6 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-primary focus:bg-white outline-none transition-all font-mono text-sm"
                        />
                    </div>

                    {/* Descriptions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Mô tả (English)</label>
                            <textarea
                                name="description"
                                rows={3}
                                placeholder="Common words used in daily life..."
                                className="w-full px-6 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-primary focus:bg-white outline-none transition-all font-medium text-gray-700"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Mô tả (Tiếng Việt)</label>
                            <textarea
                                name="viDescription"
                                rows={3}
                                placeholder="Các từ vựng thông dụng trong đời sống..."
                                className="w-full px-6 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-primary focus:bg-white outline-none transition-all font-medium text-gray-700"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Level */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Cấp độ *</label>
                            <select
                                name="level"
                                required
                                className="w-full px-6 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-primary focus:bg-white outline-none transition-all font-bold text-gray-900 appearance-none"
                            >
                                <option value="Beginner">Cơ bản (Beginner)</option>
                                <option value="Intermediate">Trung cấp (Intermediate)</option>
                                <option value="Advanced">Nâng cao (Advanced)</option>
                            </select>
                        </div>

                        {/* Image Emoji */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Emoji / Biểu tượng</label>
                            <input
                                name="image"
                                type="text"
                                placeholder="e.g. 📚, ✈️, 🍔"
                                className="w-full px-6 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-primary focus:bg-white outline-none transition-all text-2xl text-center"
                            />
                        </div>
                    </div>

                    {/* Gradient Picker */}
                    <div className="space-y-4">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Màu sắc chủ đạo (Gradient)</label>
                        <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
                            {gradients.map((g) => (
                                <label key={g} className="relative cursor-pointer group">
                                    <input type="radio" name="color" value={g} className="peer sr-only" defaultChecked={g === gradients[0]} />
                                    <div className={`h-12 w-full rounded-xl bg-gradient-to-br ${g} ring-offset-2 peer-checked:ring-4 ring-primary transition-all group-hover:scale-105`}></div>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="pt-6">
                        <button
                            type="submit"
                            className="w-full py-5 bg-primary text-white font-black text-xl rounded-[1.5rem] shadow-glow-primary hover:bg-primary-dark hover:-translate-y-1 transition-all active:translate-y-0"
                        >
                            TẠO CHỦ ĐỀ NGAY 🚀
                        </button>
                    </div>
                </Form>
            </div>
        </div>
    );
}
