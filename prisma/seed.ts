import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    // Clean up existing data
    await prisma.userProgress.deleteMany({});
    await prisma.word.deleteMany({});
    await prisma.topic.deleteMany({});

    console.log("Seeding topics and words (Full Vietnamese Localization)...");

    const topics = [
        {
            title: "Travel Essentials",
            viTitle: "Du lịch Cơ bản",
            slug: "travel-essentials",
            level: "Beginner",
            image: "✈️",
            color: "from-sky-400 to-blue-500",
            description: "Must-know words for your next international trip.",
            viDescription: "Những từ vựng thiết yếu cho chuyến du lịch quốc tế tiếp theo của bạn.",
            words: [
                {
                    term: "Departure",
                    definition: "The act of leaving a place.",
                    viDefinition: "Hành động rời khỏi một địa điểm để bắt đầu một chuyến đi.",
                    translation: "Sự khởi hành",
                    example: "Our departure was delayed by two hours.",
                    viExample: "Chuyến khởi hành của chúng tôi đã bị hoãn lại hai tiếng.",
                    phonetic: "/dɪˈpɑː.tʃər/",
                    type: "noun"
                },
                {
                    term: "Destination",
                    definition: "The place to which someone or something is going.",
                    viDefinition: "Nơi mà ai đó hoặc cái gì đó đang hướng tới.",
                    translation: "Điểm đến",
                    example: "We arrived at our destination exhausted.",
                    viExample: "Chúng tôi đã đến điểm đến trong tình trạng kiệt sức.",
                    phonetic: "/ˌdes.tɪˈneɪ.ʃən/",
                    type: "noun"
                },
                {
                    term: "Accommodation",
                    definition: "A place to live or stay.",
                    viDefinition: "Nơi để sinh sống hoặc lưu trú (như khách sạn, nhà nghỉ).",
                    translation: "Chỗ ở",
                    example: "The price includes travel and accommodation.",
                    viExample: "Giá đã bao gồm chi phí đi lại và chỗ ở.",
                    phonetic: "/əˌkɒm.əˈdeɪ.ʃən/",
                    type: "noun"
                },
                {
                    term: "Itinerary",
                    definition: "A planned route or journey.",
                    viDefinition: "Một lộ trình hoặc hành trình đã được lên kế hoạch sẵn.",
                    translation: "Lịch trình",
                    example: "We must stick to our itinerary to see everything.",
                    viExample: "Chúng ta phải bám sát lịch trình để xem được mọi thứ.",
                    phonetic: "/aɪˈtɪn.ər.ər.i/",
                    type: "noun"
                },
                {
                    term: "Souvenir",
                    definition: "A thing that is kept as a reminder of a person, place, or event.",
                    viDefinition: "Vật kỷ niệm dùng để nhớ về một người, địa điểm hoặc sự kiện.",
                    translation: "Quà lưu niệm",
                    example: "I bought a small model of the Eiffel Tower as a souvenir.",
                    viExample: "Tôi đã mua một mô hình tháp Eiffel nhỏ làm quà lưu niệm.",
                    phonetic: "/ˌsuː.vəˈnɪər/",
                    type: "noun"
                },
            ]
        },
        {
            title: "Business Professional",
            viTitle: "Tiếng Anh Công sở",
            slug: "business-101",
            level: "Intermediate",
            image: "💼",
            color: "from-slate-700 to-slate-900",
            description: "Master the language of the modern workplace.",
            viDescription: "Làm chủ ngôn ngữ trong môi trường làm việc hiện đại.",
            words: [
                {
                    term: "Collaborate",
                    definition: "To work together with others.",
                    viDefinition: "Làm việc cùng với những người khác để đạt mục tiêu chung.",
                    translation: "Cộng tác",
                    example: "We need to collaborate on this project.",
                    viExample: "Chúng ta cần cộng tác trong dự án này.",
                    phonetic: "/kəˈlæb.ə.reɪt/",
                    type: "verb"
                },
                {
                    term: "Objective",
                    definition: "Something that you plan to achieve.",
                    viDefinition: "Điều mà bạn dự định đạt được; mục đích.",
                    translation: "Mục tiêu",
                    example: "Our main objective is to increase sales.",
                    viExample: "Mục tiêu chính của chúng tôi là tăng doanh số.",
                    phonetic: "/əbˈdʒek.tɪv/",
                    type: "noun"
                },
                {
                    term: "Negotiate",
                    definition: "To have formal discussions with someone in order to reach an agreement.",
                    viDefinition: "Thảo luận chính thức để đi đến một thỏa thuận.",
                    translation: "Đàm phán",
                    example: "I managed to negotiate a better deal.",
                    viExample: "Tôi đã cố gắng đàm phán được một thỏa thuận tốt hơn.",
                    phonetic: "/nəˈɡəʊ.ʃi.eɪt/",
                    type: "verb"
                },
                {
                    term: "Feasibility",
                    definition: "The state or degree of being easily or conveniently done.",
                    viDefinition: "Khả năng một kế hoạch có thể được thực hiện thành công.",
                    translation: "Tính khả thi",
                    example: "We are studying the feasibility of the new project.",
                    viExample: "Chúng tôi đang nghiên cứu tính khả thi của dự án mới.",
                    phonetic: "/ˌfiː.zəˈbɪl.ə.ti/",
                    type: "noun"
                },
                {
                    term: "Incentive",
                    definition: "A thing that motivates or encourages someone to do something.",
                    viDefinition: "Điều gì đó thúc đẩy hoặc khuyến khích ai đó hành động.",
                    translation: "Sự khuyến khích, ưu đãi",
                    example: "The company offers a bonus as an incentive for high performance.",
                    viExample: "Công ty đưa ra khoản thưởng như một sự khuyến khích cho hiệu suất cao.",
                    phonetic: "/ɪnˈsen.tɪv/",
                    type: "noun"
                },
            ]
        },
        {
            title: "Technology & AI",
            viTitle: "Công nghệ & AI",
            slug: "tech-ai",
            level: "Advanced",
            image: "🤖",
            color: "from-purple-600 to-indigo-700",
            description: "Explore the cutting edge of digital innovation.",
            viDescription: "Khám phá ranh giới của sự đổi mới kỹ thuật số.",
            words: [
                {
                    term: "Algorithm",
                    definition: "A process or set of rules to be followed in calculations.",
                    viDefinition: "Một quy trình hoặc bộ quy tắc được làm theo trong các phép toán.",
                    translation: "Thuật toán",
                    example: "The search engine uses a complex algorithm to rank pages.",
                    viExample: "Công cụ tìm kiếm sử dụng một thuật toán phức tạp để xếp hạng trang.",
                    phonetic: "/ˈæl.ɡə.rɪ.ðəm/",
                    type: "noun"
                },
                {
                    term: "Encryption",
                    definition: "The process of converting information or data into a code.",
                    viDefinition: "Quy trình chuyển đổi thông tin thành mã để bảo mật.",
                    translation: "Mã hóa",
                    example: "End-to-end encryption ensures your messages remain private.",
                    viExample: "Mã hóa đầu cuối đảm bảo tin nhắn của bạn được riêng tư.",
                    phonetic: "/ɪnˈkrɪp.ʃən/",
                    type: "noun"
                },
                {
                    term: "Scalability",
                    definition: "The capacity to be changed in size or scale.",
                    viDefinition: "Khả năng thay đổi kích thước hoặc quy mô của một hệ thống.",
                    translation: "Khả năng mở rộng",
                    example: "The platform was built with scalability in mind.",
                    viExample: "Nền tảng được xây dựng với mục tiêu có khả năng mở rộng.",
                    phonetic: "/ˌskeɪ.ləˈbɪl.ə.ti/",
                    type: "noun"
                },
                {
                    term: "Automation",
                    definition: "The use of largely automatic equipment in a system or operation.",
                    viDefinition: "Việc sử dụng thiết bị tự động trong một hệ thống hoặc hoạt động.",
                    translation: "Tự động hóa",
                    example: "Automation has significantly increased production efficiency.",
                    viExample: "Tự động hóa đã tăng đáng kể hiệu quả sản xuất.",
                    phonetic: "/ˌɔː.təˈmeɪ.ʃən/",
                    type: "noun"
                },
                {
                    term: "Neural Network",
                    definition: "A computer system modeled on the human brain.",
                    viDefinition: "Hệ thống máy tính được mô phỏng theo cấu trúc não người.",
                    translation: "Mạng thần kinh nhân tạo",
                    example: "Deep learning relies heavily on artificial neural networks.",
                    viExample: "Học sâu dựa rất nhiều vào các mạng thần kinh nhân tạo.",
                    phonetic: "/ˈnjʊə.rəl ˈnet.wɜːk/",
                    type: "noun"
                },
            ]
        }
    ];

    for (const topicData of topics) {
        const { words, ...topicInfo } = topicData;
        await prisma.topic.create({
            data: {
                ...topicInfo,
                words: {
                    create: words
                }
            }
        });
    }

    console.log("Seed complete! 🌱");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
