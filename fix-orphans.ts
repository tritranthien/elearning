import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Checking for orphaned words...");

        // Find all topics
        const topics = await prisma.topic.findMany();
        if (topics.length === 0) {
            console.log("No topics found. Cannot link words.");
            return;
        }

        console.log(`Found ${topics.length} topics.`);

        // Find orphaned words (topicId is null)
        const orphans = await prisma.word.findMany({
            where: { topicId: null }
        });

        console.log(`Found ${orphans.length} orphaned words.`);

        if (orphans.length > 0) {
            // Link them to the first topic (presumably "Greetings")
            const targetTopic = topics[0];
            console.log(`Linking ${orphans.length} words to topic "${targetTopic.title}" (ID: ${targetTopic.id})...`);

            const result = await prisma.word.updateMany({
                where: { topicId: null },
                data: { topicId: targetTopic.id }
            });

            console.log(`Successfully linked ${result.count} words.`);
        } else {
            console.log("No orphaned words to fix.");
        }

    } catch (e) {
        console.error("Error fixing data:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
