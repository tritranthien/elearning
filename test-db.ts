import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function check() {
    const word = await prisma.word.findFirst();
    console.log("Check Word:", JSON.stringify(word, null, 2));
    const topic = await prisma.topic.findFirst({ include: { words: true } });
    console.log("Check Topic & first word:", JSON.stringify({
        title: topic?.title,
        viTitle: (topic as any)?.viTitle,
        firstWordTranslation: (topic?.words[0] as any)?.translation
    }, null, 2));
}

check()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
