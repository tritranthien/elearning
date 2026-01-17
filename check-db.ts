import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    try {
        console.log("--- START DB CHECK ---");
        const topicCount = await prisma.topic.count();
        console.log(`Topic Count: ${topicCount}`);

        const topics = await prisma.topic.findMany({
            include: { words: true } // Include words directly to see if they are linked
        });

        topics.forEach(t => {
            console.log(`Topic: ${t.title} (${t.slug})`);
            console.log(` - Words linked: ${t.words.length}`);
            if (t.words.length > 0) {
                console.log(` - Sample linked word: ${t.words[0].term}`);
            }
        });

        const wordCount = await prisma.word.count();
        console.log(`Total Word Count in DB: ${wordCount}`);

        const orphans = await prisma.word.count({ where: { topicId: null } });
        console.log(`Orphaned Words (topicId=null): ${orphans}`);

        if (wordCount > 0) {
            const allWords = await prisma.word.findMany({ take: 5 });
            console.log("First 5 Words in DB:", JSON.stringify(allWords, null, 2));
        }
        console.log("--- END DB CHECK ---");
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
