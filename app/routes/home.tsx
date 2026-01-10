import { Link, useOutletContext } from "react-router";
import type { Route } from "./+types/home";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "LinguaFast - Làm chủ tiếng Anh nhanh chóng" },
    { name: "description", content: "Cách nhanh nhất để học từ vựng tiếng Anh trôi chảy." },
  ];
}

export default function Home() {
  const { user } = useOutletContext<{ user: any }>();

  return (
    <div>
      {/* Hero Section */}
      <section className="py-24 text-center">
        <div className="container mx-auto px-4">
          <div className="max-w-[800px] mx-auto">
            <div className="inline-block px-4 py-1 mb-6 rounded-full bg-primary-light text-primary font-semibold text-sm">
              🚀 Học từ vựng dựa trên khoa học não bộ
            </div>

            <h1 className="text-5xl md:text-6xl font-black leading-tight tracking-tight text-gray-900 mb-6">
              Làm chủ 1000+ từ vựng <br />
              chỉ trong <span className="text-transparent bg-clip-text bg-gradient-to-br from-primary to-accent">30 Ngày</span>
            </h1>

            <p className="text-xl text-gray-500 mb-10 leading-relaxed max-w-2xl mx-auto">
              Quên đi các danh sách từ vựng khô khan. Học tiếng Anh qua flashcard tương tác, lặp lại ngắt quãng và ngữ cảnh thực tế.
            </p>

            <div className="flex gap-4 justify-center">
              <Link to={user ? "/topics" : "/register"} className="px-8 py-4 rounded-xl bg-primary text-white text-lg font-bold shadow-sm hover:bg-primary-dark hover:-translate-y-px hover:shadow-glow transition-all">
                {user ? "Tiếp tục học" : "Bắt đầu ngay"}
              </Link>
              <Link to="/topics" className="px-8 py-4 rounded-xl border border-gray-200 bg-white text-gray-700 text-lg font-bold hover:border-primary hover:text-primary transition-colors">
                Khám phá kho từ
              </Link>
            </div>

            <div className="mt-16 opacity-80">
              <p className="text-sm text-gray-500 mb-4 font-bold uppercase tracking-widest">Được tin dùng bởi học viên từ</p>
              <div className="flex justify-center gap-12 grayscale opacity-60">
                <span className="font-bold text-xl tracking-tighter">HARVARD</span>
                <span className="font-bold text-xl tracking-tighter">DUOLINGO</span>
                <span className="font-bold text-xl tracking-tighter">BABBEL</span>
                <span className="font-bold text-xl tracking-tighter">MEMRISE</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black mb-4 text-gray-900">Tại sao LinguaFast hiệu quả?</h2>
            <p className="text-gray-500 max-w-2xl mx-auto text-lg font-medium">
              Chúng tôi sử dụng khoa học nhận thức để đảm bảo bạn không bao giờ quên những gì đã học.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              icon="🧠"
              title="Lặp lại ngắt quãng"
              desc="Thuật toán Spaced Repetition biết chính xác khi nào bạn sắp quên và nhắc bạn ôn tập đúng lúc."
            />
            <FeatureCard
              icon="⚡"
              title="Flashcard Thông minh"
              desc="Thẻ học phong phú với âm thanh, hình ảnh và câu ví dụ để tạo liên kết trí nhớ mạnh mẽ."
            />
            <FeatureCard
              icon="🎮"
              title="Gamification"
              desc="Duy trì chuỗi ngày học (streak), mở khóa thành tựu và thi đua cùng bạn bè mỗi ngày."
            />
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="rounded-3xl bg-gradient-to-br from-primary to-primary-dark p-16 text-center text-white shadow-xl">
            <h2 className="text-4xl font-black mb-6">Mở rộng vốn từ ngay hôm nay</h2>
            <p className="text-xl text-white/90 mb-10 max-w-2xl mx-auto font-medium">
              {user ? "Tiếp tục hành trình chinh phục tiếng Anh từ nơi bạn đã dừng lại." : "Tạo tài khoản miễn phí và nhận ngay bộ \"500 Từ cốt lõi\" miễn phí."}
            </p>
            <Link to={user ? "/topics" : "/register"} className="inline-block px-10 py-4 rounded-xl bg-white text-primary text-lg font-black shadow-2xl hover:bg-gray-50 hover:-translate-y-1 transition-all">
              {user ? "Bắt đầu học ngay" : "Đăng ký miễn phí"}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: string, title: string, desc: string }) {
  return (
    <div className="rounded-2xl bg-gray-50/50 p-8 border border-transparent hover:border-gray-200 hover:bg-white hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
      <div className="text-4xl mb-6 bg-white w-20 h-20 flex items-center justify-center rounded-2xl shadow-sm">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3 text-gray-900">{title}</h3>
      <p className="text-gray-500 leading-relaxed">{desc}</p>
    </div>
  );
}
