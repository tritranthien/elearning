import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    // Clean up existing data
    await prisma.userProgress.deleteMany({});
    await prisma.word.deleteMany({});
    await prisma.topic.deleteMany({});

    console.log("Seeding topics and words...");

    const travel = await prisma.topic.create({
        data: {
            title: "Travel Essentials",
            slug: "travel-essentials",
            level: "Beginner",
            image: "✈️",
            color: "from-sky-400 to-blue-500",
            description: "Must-know words for your next international trip.",
            words: {
                create: [
                    { term: "Departure", definition: "The act of leaving a place.", example: "Our departure was delayed by two hours.", phonetic: "/dɪˈpɑː.tʃər/", type: "noun" },
                    { term: "Destination", definition: "The place to which someone or something is going.", example: "We arrived at our destination exhausted.", phonetic: "/ˌdes.tɪˈneɪ.ʃən/", type: "noun" },
                    { term: "Accommodation", definition: "A place to live or stay.", example: "The price includes travel and accommodation.", phonetic: "/əˌkɒm.əˈdeɪ.ʃən/", type: "noun" },
                ]
            }
        }
    });

    const business = await prisma.topic.create({
        data: {
            title: "Business Professional",
            slug: "business-101",
            level: "Intermediate",
            image: "💼",
            color: "from-slate-700 to-slate-900",
            description: "Master the language of the modern workplace.",
            words: {
                create: [
                    { term: "Collaborate", definition: "To work together with others.", example: "We need to collaborate on this project.", phonetic: "/kəˈlæb.ə.reɪt/", type: "verb" },
                    { term: "Objective", definition: "Something that you plan to achieve.", example: "Our main objective is to increase sales.", phonetic: "/əbˈdʒek.tɪv/", type: "noun" },
                    { term: "Negotiate", definition: "To have formal discussions with someone in order to reach an agreement.", example: "I managed to negotiate a better deal.", phonetic: "/nəˈɡəʊ.ʃi.eɪt/", type: "verb" },
                ]
            }
        }
    });

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
